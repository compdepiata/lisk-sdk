/*
 * Copyright © 2021 Lisk Foundation
 *
 * See the LICENSE file at the top-level directory of this distribution
 * for licensing information.
 *
 * Unless otherwise agreed in a custom licensing agreement with the Lisk Foundation,
 * no part of this software, including this file, may be copied, modified,
 * propagated, or distributed except according to the terms contained in the
 * LICENSE file.
 *
 * Removal or modification of this copyright notice is prohibited.
 */
import { rmdirSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { ApplicationEnv } from '../../../src/testing';
import { PartialApplicationConfig, TokenModule, DPoSModule } from '../../../src';
import { defaultConfig } from '../../../src/testing/fixtures';

const appLabel = 'beta-sdk-app';
const dataPath = join(homedir(), '.lisk', appLabel);

describe('Application Environment', () => {
	let appEnv: ApplicationEnv;
	let exitMock: jest.SpyInstance;

	beforeEach(() => {
		exitMock = jest.spyOn(process, 'exit').mockImplementation(jest.fn() as never);
		if (existsSync(dataPath)) {
			rmdirSync(dataPath, { recursive: true });
		}
	});

	afterEach(async () => {
		await appEnv.stopApplication();
		exitMock.mockRestore();
	});

	describe('Get Application Environment', () => {
		it('should return valid environment for empty modules', async () => {
			appEnv = new ApplicationEnv({ modules: [], config: { label: appLabel } });
			await appEnv.startApplication();

			expect(appEnv.application).toBeDefined();
			expect(appEnv.ipcClient).toBeDefined();
			expect(appEnv.dataPath).toBeDefined();
			expect(appEnv.lastBlock).toBeDefined();
			expect(appEnv.networkIdentifier).toBeDefined();
			expect(appEnv.application.getRegisteredModules()).toEqual([]);
		});

		it('should return valid environment with custom module', async () => {
			appEnv = new ApplicationEnv({ modules: [TokenModule, DPoSModule] });
			await appEnv.startApplication();

			expect(appEnv.application).toBeDefined();
			expect(appEnv.ipcClient).toBeDefined();
			expect(appEnv.dataPath).toBeDefined();
			expect(appEnv.lastBlock).toBeDefined();
			expect(appEnv.networkIdentifier).toBeDefined();
			expect(appEnv.application.getRegisteredModules()).toContain([TokenModule, DPoSModule]);
		});

		it('should return valid environment with custom config', async () => {
			appEnv = new ApplicationEnv({
				modules: [],
				plugins: [],
				config: defaultConfig as PartialApplicationConfig,
			});

			await appEnv.startApplication();

			expect(appEnv.application).toBeDefined();
			expect(appEnv.ipcClient).toBeDefined();
			expect(appEnv.dataPath).toBeDefined();
			expect(appEnv.lastBlock).toBeDefined();
			expect(appEnv.networkIdentifier).toBeDefined();
			expect(appEnv.application.getRegisteredModules()).toEqual([]);
		});
	});
});
