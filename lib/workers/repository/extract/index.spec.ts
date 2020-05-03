import { defaultConfig, mocked, platform } from '../../../../test/util';
import { RenovateConfig } from '../../../config';
import * as _managerFiles from './manager-files';
import { extractAllDependencies } from '.';

jest.mock('./manager-files');

const managerFiles = mocked(_managerFiles);

describe('workers/repository/extract/index', () => {
  describe('extractAllDependencies()', () => {
    let config: RenovateConfig;
    const fileList = ['README', 'package.json', 'tasks/ansible.yaml'];
    beforeEach(() => {
      jest.resetAllMocks();
      platform.getFileList.mockResolvedValue(fileList);
      config = { ...defaultConfig };
    });
    it('runs', async () => {
      managerFiles.getManagerPackageFiles.mockResolvedValue([{} as never]);
      const res = await extractAllDependencies(config);
      expect(Object.keys(res).includes('ansible')).toBe(true);
    });
    it('skips non-enabled managers', async () => {
      config.enabledManagers = ['npm'];
      managerFiles.getManagerPackageFiles.mockResolvedValue([{} as never]);
      const res = await extractAllDependencies(config);
      expect(res).toMatchSnapshot();
    });
    it('checks custom managers', async () => {
      managerFiles.getManagerPackageFiles.mockResolvedValue([{} as never]);
      config.regexManagers = [{ fileMatch: [], matchStrings: [''] }];
      const res = await extractAllDependencies(config);
      expect(Object.keys(res).includes('regex')).toBe(true);
    });
  });
});
