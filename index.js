const tc = require("@actions/tool-cache");
const core = require("@actions/core");
const github = require("@actions/github");
const semver = require("semver");
const createWrapper = require("actions-output-wrapper");

async function action() {
  let version = core.getInput("kced-version", { required: false });

  if (!version) {
    // Fetch the latest release version
    const myToken = core.getInput("token");
    const octokit = github.getOctokit(myToken);
    const { data: releases } = await octokit.rest.repos.listReleases({
      owner: "Kong",
      repo: "go-apiops",
    });

    if (!releases.length) {
      throw new Error(`No releases found in kong/go-apiops`);
    }

    version = releases[0].tag_name.replace(/^v/, "");
  }

  const semverVersion = semver.valid(semver.coerce(version));

  if (!semverVersion) {
    throw new Error(`Invalid version provided: '${version}'`);
  }

  let os = getPlatform(process.platform);
  const fullVersion = `${semverVersion}-${os}`;
  console.log(`Installing kced version ${fullVersion}`);

  let kcedDirectory = tc.find("kced", fullVersion);
  if (!kcedDirectory) {
    const versionUrl = `https://github.com/Kong/go-apiops/releases/download/v${semverVersion}/go-apiops_${semverVersion}_${os}_amd64.tar.gz`;
    const kcedPath = await tc.downloadTool(versionUrl);

    const kcedExtractedFolder = await tc.extractTar(
      kcedPath,
      `go-apiops_${fullVersion}`
    );

    kcedDirectory = await tc.cacheDir(kcedExtractedFolder, "kced", fullVersion);
  }

  core.addPath(kcedDirectory);
  if (core.getInput("wrapper") === "true") {
    await createWrapper({
      originalName: "kced",
    });
  }
}

function getPlatform(platform) {
  if (platform === "win32") {
    return "windows";
  }

  if (process.platform === "darwin") {
    return "darwin";
  }

  return "linux";
}

if (require.main === module) {
  action();
}

module.exports = action;
