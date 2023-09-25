import type { Lockfile } from '@pnpm/lockfile-types';
import { dump, load } from 'js-yaml';
import { logger } from '../../../../../../logger';
import type { UpdateLockedConfig, UpdateLockedResult } from '../../../../types';
import { getPkgReleasesCached } from '../common/parent-version';

export async function updateLockedDependency(
  config: UpdateLockedConfig
): Promise<UpdateLockedResult> {
  const { depName, currentVersion, newVersion, lockFile, lockFileContent } =
    config;
  logger.debug(
    `npm.updateLockedDependency: ${depName}@${currentVersion} -> ${newVersion} [${lockFile}]`
  );

  let pnpmLock: Lockfile;

  try {
    pnpmLock = load(lockFileContent!) as Lockfile;
  } catch (err) {
    logger.error({ err }, 'Failed to parse pnpm lock file');
    return { status: 'update-failed' };
  }

  try {
    const oldResolutionPath = `/${depName}@${currentVersion}`;
    const pkg = pnpmLock.packages?.[oldResolutionPath];
    if (!pkg) {
      logger.error(`${oldResolutionPath} not found in ${lockFile}`);
      return { status: 'update-failed' };
    }
    delete pnpmLock.packages![oldResolutionPath];
    if ('integrity' in pkg.resolution) {
      const releases = await getPkgReleasesCached(depName);
      const newDigest = releases?.releases.find(
        (r) => r.version === newVersion
      )?.newDigest;
      if (!newDigest) {
        logger.error(`New integrity not found for ${depName}@${newVersion}`);
        return { status: 'update-failed' };
      }
      pkg.resolution.integrity = newDigest;
    }
    const newResolutionPath = `/${depName}@${newVersion}`;
    pnpmLock.packages![newResolutionPath] = pkg;

    for (const parent of Object.values(pnpmLock.packages!)) {
      if (parent.dependencies?.[depName] === currentVersion) {
        parent.dependencies[depName] = newVersion;
        // TODO: Check compatibility
      }
    }
    const newLockFileContent = dump(pnpmLock, LOCKFILE_YAML_FORMAT);
    // istanbul ignore if: cannot test
    if (newLockFileContent === lockFileContent) {
      logger.error('Failed to make any changes to lock file');
      return { status: 'update-failed' };
    }
    return { status: 'updated', files: { [lockFile]: newLockFileContent } };
  } catch (err) /* istanbul ignore next */ {
    logger.error({ err }, 'updateLockedDependency() error');
    return { status: 'update-failed' };
  }
}

const LOCKFILE_YAML_FORMAT = {
  blankLines: true,
  lineWidth: 1000,
  noCompatMode: true,
  noRefs: true,
  sortKeys: false,
};
