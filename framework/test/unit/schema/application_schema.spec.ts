/*
 * Copyright © 2019 Lisk Foundation
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

import { validator } from '@liskhq/lisk-validator';
import { objects } from '@liskhq/lisk-utils';
import { applicationConfigSchema } from '../../../src/schema/application_config_schema';

describe('schema/application_config_schema.js', () => {
	it('application config schema must match to the snapshot.', () => {
		expect(applicationConfigSchema).toMatchSnapshot();
	});

	it('should validate if module properties are objects', () => {
		const config = objects.cloneDeep(applicationConfigSchema.default);
		config.genesis.modules = { myModule: { myProp: 1 } };

		const errors = validator.validate(applicationConfigSchema, config);

		expect(errors).toHaveLength(0);
	});

	it('should not validate if module properties are not objects', () => {
		const config = objects.cloneDeep(applicationConfigSchema.default);
		config.genesis.modules = { myModule: 10 };

		const errors2 = validator.validate(applicationConfigSchema, config);

		expect(errors2).toHaveLength(1);
		expect(errors2[0]).toEqual(
			expect.objectContaining({
				dataPath: '.genesis.modules.myModule',
				keyword: 'type',
				message: 'must be object',
			}),
		);
	});
});
