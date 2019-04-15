const { DappTransaction } = require('@liskhq/lisk-transactions');

const _ = require('lodash');
const Application = require('../../../../../src/controller/application');
const validator = require('../../../../../src/controller/helpers/validator');
const constants = require('../../../../../../framework/src/controller/schema/constants');
const applicationSchema = require('../../../../../src/controller/schema/application');
const constantsSchema = require('../../../../../src/controller/schema/constants');

jest.mock('../../../../../src/components/logger');
jest.mock('../../../../../src/components/logger');

// const appSchema = {
// 	type: 'object',
// 	properties: {
// 		NETWORK: {
// 			type: 'string',
// 			description:
// 				'lisk network [devnet|betanet|mainnet|testnet]. Defaults to "devnet"',
// 			enum: ['devnet', 'alphanet', 'betanet', 'testnet', 'mainnet'],
// 			env: 'LISK_NETWORK',
// 			arg: '-n,--network',
// 		},
// 		CUSTOM_CONFIG_FILE: {
// 			type: ['string', 'null'],
// 			description: 'Custom configuration file path',
// 			default: null,
// 			env: 'LISK_CONFIG_FILE',
// 			arg: '-c,--config',
// 		},
// 	},
// 	default: {
// 		NETWORK: 'devnet',
// 		CUSTOM_CONFIG_FILE: null,
// 	},
// };

const appConfig = {
	app: {
		version: '1.6.0',
		minVersion: '1.0.0',
		protocolVersion: '1.0',
	},
};

const networkConfig = require('../../../../fixtures/config/devnet/config');
const genesisBlock = require('../../../../fixtures/config/devnet/genesis_block');

describe('Application', () => {
	// Arrange
	const frameworkTxTypes = ['0', '1', '2', '3', '4'];
	const params = {
		label: 'jest-unit',
		genesisBlock,
		constants,
		config: [networkConfig, appConfig],
	};

	describe('#constructor', () => {
		afterEach(() => {
			// So we can start a fresh schema each time Application is instantiated
			validator.validator.removeSchema();
			validator.parserAndValidator.removeSchema();
		});

		it('should accept function as label argument', () => {
			// Arrange
			const labelFn = () => 'jest-unit';

			// Act
			const app = new Application(labelFn, params.genesisBlock, params.config);
			expect(app.label).toBe(labelFn);
		});

		it('should set filename for logger if logger component was not provided', () => {
			// Arrange
			const configWithoutLogger = _.cloneDeep(params.config);
			delete configWithoutLogger[0].components.logger;
			delete configWithoutLogger[1].components.logger;

			// Act
			const app = new Application(
				params.label,
				params.genesisBlock,
				configWithoutLogger
			);

			expect(app.config.components.logger.logFileName).toBe(
				`${process.cwd()}/logs/${params.label}/lisk.log`
			);
		});

		it('should load applicationSchema and constantsSchema', () => {
			const loadSchemaSpy = jest.spyOn(validator, 'loadSchema');

			// Act
			new Application(params.label, params.genesisBlock, params.config);

			// Assert
			expect(loadSchemaSpy).toHaveBeenCalledWith(applicationSchema);
			expect(loadSchemaSpy).toHaveBeenCalledWith(constantsSchema);
		});

		it('should validate constructor arguments', () => {
			// Act
			const validateSpy = jest.spyOn(validator, 'validate');
			const parseEnvArgAndValidateSpy = jest.spyOn(
				validator,
				'parseEnvArgAndValidate'
			);
			new Application(params.label, params.genesisBlock, params.config);

			// Assert
			expect(validateSpy).toHaveBeenNthCalledWith(
				1,
				applicationSchema.appLabel,
				params.label
			);
			expect(validateSpy).toHaveBeenNthCalledWith(
				2,
				applicationSchema.genesisBlock,
				params.genesisBlock
			);
			expect(parseEnvArgAndValidateSpy).toHaveBeenNthCalledWith(
				1,
				applicationSchema.config,
				_.defaultsDeep(...params.config)
			);
			expect(parseEnvArgAndValidateSpy).toHaveBeenNthCalledWith(
				2,
				constantsSchema.constants,
				expect.any(Object)
			);
		});

		it('should set internal variables', () => {
			// Act
			const app = new Application(
				params.label,
				params.genesisBlock,
				params.config
			);

			// Assert
			// Investigate if these are implementation details
			expect(app.genesisBlock).toBe(params.genesisBlock);
			expect(app.label).toBe(params.label);
			expect(app.config).toEqual(_.defaultsDeep(...params.config));
			expect(app.controller).toBeNull();
		});

		it('should contain all framework related transactions.', () => {
			// Act
			const app = new Application(
				params.label,
				params.genesisBlock,
				params.constants,
				params.config
			);

			// Assert
			expect(Object.keys(app.getTransactions())).toEqual(frameworkTxTypes);
		});

		it('should throw validation error if constants are overriden by the user', () => {
			const customConfig = [
				...[
					{
						app: {
							genesisConfig: {
								CONSTANT: 'aConstant',
							},
						},
					},
				],
				...params.config,
			];

			expect(() => {
				new Application(params.label, params.genesisBlock, customConfig);
			}).toThrow('Schema validation error');
		});
	});

	describe('#registerTransaction', () => {
		it('should throw error when transaction type is missing.', () => {
			// Arrange
			const app = new Application(
				params.label,
				params.genesisBlock,
				params.constants,
				params.config
			);

			// Act && Assert
			expect(() => app.registerTransaction()).toThrow(
				'Transaction type is required as an integer'
			);
		});

		it('should throw error when transaction type is not integer.', () => {
			// Arrange
			const app = new Application(
				params.label,
				params.genesisBlock,
				params.constants,
				params.config
			);

			// Act && Assert
			expect(() => app.registerTransaction('5')).toThrow(
				'Transaction type is required as an integer'
			);
		});

		it('should throw error when transaction class is missing.', () => {
			// Arrange
			const app = new Application(
				params.label,
				params.genesisBlock,
				params.constants,
				params.config
			);

			// Act && Assert
			expect(() => app.registerTransaction(5)).toThrow(
				'Transaction implementation is required'
			);
		});

		it('should throw error when transaction type is already registered.', () => {
			// Arrange
			const app = new Application(
				params.label,
				params.genesisBlock,
				params.constants,
				params.config
			);

			// Act && Assert
			expect(() => app.registerTransaction(1, DappTransaction)).toThrow(
				'A transaction type "1" is already registered.'
			);
		});

		it('should register transaction when passing a new transaction type and a transaction implementation.', () => {
			// Arrange
			const app = new Application(
				params.label,
				params.genesisBlock,
				params.constants,
				params.config
			);

			// Act
			app.registerTransaction(5, DappTransaction);

			// Assert
			expect(app.getTransaction(5)).toBe(DappTransaction);
		});
	});
});
