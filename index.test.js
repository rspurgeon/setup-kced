const action = require("./index");
const tc = require("@actions/tool-cache");
const core = require("@actions/core");
const mockEnv = require("mocked-env");

const nock = require("nock");
nock.disableNetConnect();

jest.mock("actions-output-wrapper");
let createWrapper = require("actions-output-wrapper");

let originalPlatform;
let restore;
let restoreTest;

beforeEach(() => {
  restore = mockEnv({
    INPUT_TOKEN: "this_token_is_not_used_due_to_mocks",
  });
  restoreTest = () => {};

  jest.spyOn(console, "log").mockImplementation();
  createWrapper.mockClear();
  originalPlatform = process.platform;
});

afterEach(() => {
  jest.restoreAllMocks();
  restore();
  restoreTest();
  if (!nock.isDone()) {
    throw new Error(
      `Not all nock interceptors were used: ${JSON.stringify(
        nock.pendingMocks()
      )}`
    );
  }
  nock.cleanAll();
  setPlatform(originalPlatform);
});

describe("automatic version fetching", () => {
  it("does not fetch when a version is provided", async () => {
    // No call to nock(), so no HTTP traffic expected
    restoreTest = mockEnv({
      "INPUT_KCED-VERSION": "0.1.11",
    });
    setPlatform("linux");
    mockToolIsInCache(true);
    mockExtraction();

    await action();
    expect(console.log).toBeCalledWith(`Installing kced version 0.1.11-linux`);
  });

  it("fetches the latest version when no version is provided", async () => {
    nock("https://api.github.com")
      .get("/repos/Kong/go-apiops/releases")
      .reply(200, [
        {
          tag_name: "v0.1.11",
        },
      ]);

    setPlatform("linux");
    mockToolIsInCache(true);
    mockExtraction();

    await action();
    expect(console.log).toBeCalledWith(`Installing kced version 0.1.11-linux`);
  });

  it("fails when there are no releases and no specific version is provided", async () => {
    nock("https://api.github.com")
      .get("/repos/Kong/go-apiops/releases")
      .reply(200, []);

    try {
      await action();
    } catch (e) {
      expect(e.message).toBe("No releases found in kong/go-apiops");
    }
  });
});

describe("version parsing", () => {
  it("throws when an invalid version is provided", async () => {
    restoreTest = mockEnv({
      "INPUT_KCED-VERSION": "banana",
    });
    expect(action).rejects.toThrow("Invalid version provided: 'banana'");
  });

  const cases = [
    ["1.7.0", "1.7.0"],
    ["1.7", "1.7.0"],
    ["1.6", "1.6.0"],
    ["1.6.4", "1.6.4"],
    ["1.8.0-beta2", "1.8.0"],
  ];

  test.each(cases)(
    `accepts a valid semver input (%s)`,
    async (version, expected) => {
      restoreTest = mockEnv({
        "INPUT_KCED-VERSION": version,
      });

      setPlatform("linux");
      mockToolIsInCache(true);
      mockExtraction();

      await action();
      expect(console.log).toBeCalledWith(
        `Installing kced version ${expected}-linux`
      );
    }
  );
});

describe("install", () => {
  it("does not download if the file is in the cache", async () => {
    restoreTest = mockEnv({
      "INPUT_KCED-VERSION": "0.1.10",
    });

    jest.spyOn(core, "addPath");
    jest.spyOn(tc, "downloadTool");

    setPlatform("linux");
    mockToolIsInCache(true);
    mockExtraction();

    await action();

    expect(tc.downloadTool).toBeCalledTimes(0);
    expect(core.addPath).toBeCalledWith("/path/to/kced");
  });

  it("downloads if it is not in the cache", async () => {
    restoreTest = mockEnv({
      "INPUT_KCED-VERSION": "0.1.11",
    });

    setPlatform("linux");
    mockToolIsInCache(false);
    mockTcDownload();
    mockExtraction();

    await action();

    const versionUrl = `https://github.com/Kong/go-apiops/releases/download/v0.1.11/go-apiops_0.1.11_linux_amd64.tar.gz`;

    expect(tc.downloadTool).toBeCalledWith(versionUrl);
    expect(tc.extractTar).toBeCalledWith(
      "./kced-downloaded",
      "go-apiops_0.1.11-linux"
    );
    expect(core.addPath).toBeCalledWith("/path/to/extracted/kced");
  });

  const osCases = [
    ["default", "linux"],
    ["linux", "linux"],
    ["win32", "windows"],
    ["darwin", "darwin"],
  ];

  test.each(osCases)("downloads correctly for %s", async (platform, os) => {
    restoreTest = mockEnv({
      "INPUT_KCED-VERSION": "0.1.11",
    });

    setPlatform(platform);
    mockToolIsInCache(false);
    mockTcDownload();
    mockExtraction();

    await action();

    expect(tc.downloadTool).toBeCalledWith(
      `https://github.com/Kong/go-apiops/releases/download/v0.1.11/go-apiops_0.1.11_${os}_amd64.tar.gz`
    );
  });
});

describe("wrapper", () => {
  it("does not apply the wrapper by default", async () => {
    restoreTest = mockEnv({
      "INPUT_KCED-VERSION": "0.1.11",
      INPUT_WRAPPER: "false",
    });

    setPlatform("linux");
    mockToolIsInCache(true);
    mockExtraction();

    await action();

    expect(createWrapper).toBeCalledTimes(0);
  });

  it("applies the wrapper when enabled", async () => {
    restoreTest = mockEnv({
      "INPUT_KCED-VERSION": "0.1.11",
      INPUT_WRAPPER: "true",
    });

    setPlatform("linux");
    mockToolIsInCache(true);
    mockExtraction();

    await action();

    expect(createWrapper).toBeCalledTimes(1);
  });
});

function mockToolIsInCache(exists) {
  const path = exists ? "/path/to/kced" : "";
  jest.spyOn(tc, "find").mockImplementationOnce(() => path);
}

function setPlatform(platform) {
  Object.defineProperty(process, "platform", {
    value: platform,
  });
}

function mockTcDownload() {
  jest
    .spyOn(tc, "downloadTool")
    .mockImplementationOnce(() => "./kced-downloaded");
}

function mockTcExtractTar() {
  jest
    .spyOn(tc, "extractTar")
    .mockImplementationOnce(() => "./kced-extracted-local");
}

function mockTcCacheDir() {
  jest
    .spyOn(tc, "cacheDir")
    .mockImplementationOnce(() => "/path/to/extracted/kced");
}

function mockCoreAddPath() {
  jest.spyOn(core, "addPath").mockImplementationOnce(() => {});
}

function mockExtraction() {
  mockTcExtractTar();
  mockTcCacheDir();
  mockCoreAddPath();
}
