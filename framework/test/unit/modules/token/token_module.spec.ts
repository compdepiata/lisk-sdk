/*
 * Copyright © 2020 Lisk Foundation
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
import { TokenModule } from '../../../../src/modules/token';
import { createGenesisBlockContext } from '../../../../src/testing';

describe('token module', () => {
	let tokenModule: TokenModule;

	beforeEach(() => {
		tokenModule = new TokenModule();
	});

	describe('initGenesisState', () => {
		it('should setup initial state', async () => {
			const context = createGenesisBlockContext({}).createGenesisBlockExecuteContext();
			return expect(tokenModule.initGenesisState(context)).resolves.toBeUndefined();
		});
	});
});
