/*
 * Copyright © 2022 Lisk Foundation
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
import { objects as objectUtils } from '@liskhq/lisk-utils';
import { validator } from '@liskhq/lisk-validator';
import { codec } from '@liskhq/lisk-codec';
import { ModuleMetadata } from '../../base_module';
import { BaseInteroperabilityModule } from '../base_interoperability_module';
import { MainchainInteroperabilityMethod } from './method';
import { MainchainCCMethod } from './cc_method';
import { MainchainInteroperabilityEndpoint } from './endpoint';
import {
	genesisInteroperabilitySchema,
	getChainAccountRequestSchema,
	getChainValidatorsRequestSchema,
	getChainValidatorsResponseSchema,
	getChannelRequestSchema,
	getMinimumMessageFeeResponseSchema,
	getRegistrationFeeSchema,
	getTerminatedOutboxAccountRequestSchema,
	getTerminatedStateAccountRequestSchema,
	isChainIDAvailableRequestSchema,
	isChainIDAvailableResponseSchema,
	isChainNameAvailableRequestSchema,
	isChainNameAvailableResponseSchema,
} from '../schemas';
import { allChainAccountsSchema, chainDataSchema, ChainStatus } from '../stores/chain_account';
import { channelSchema } from '../stores/channel_data';
import { ownChainAccountSchema } from '../stores/own_chain_account';
import { terminatedStateSchema } from '../stores/terminated_state';
import { terminatedOutboxSchema } from '../stores/terminated_outbox';
import { TokenMethod } from '../../token';
import {
	RecoverMessageCommand,
	RegisterSidechainCommand,
	SubmitMainchainCrossChainUpdateCommand,
	TerminateSidechainForLivenessCommand,
} from './commands';
import { CcmProcessedEvent } from '../events/ccm_processed';
import { ChainAccountUpdatedEvent } from '../events/chain_account_updated';
import { CcmSendSuccessEvent } from '../events/ccm_send_success';
import { TerminatedStateCreatedEvent } from '../events/terminated_state_created';
import { TerminatedOutboxCreatedEvent } from '../events/terminated_outbox_created';
import { MainchainInteroperabilityInternalMethod } from './internal_method';
import { InitializeMessageRecoveryCommand } from './commands/initialize_message_recovery';
import {
	ChainInfo,
	FeeMethod,
	GenesisInteroperability,
	TerminatedOutboxAccountWithChainID,
	TerminatedStateAccountWithChainID,
} from '../types';
import { MainchainCCChannelTerminatedCommand, MainchainCCRegistrationCommand } from './cc_commands';
import { RecoverStateCommand } from './commands/recover_state';
import { CcmSentFailedEvent } from '../events/ccm_send_fail';
import { InvalidRegistrationSignatureEvent } from '../events/invalid_registration_signature';
import { InvalidCertificateSignatureEvent } from '../events/invalid_certificate_signature';
import { CHAIN_NAME_MAINCHAIN, EMPTY_HASH, MODULE_NAME_INTEROPERABILITY } from '../constants';
import { GenesisBlockExecuteContext } from '../../../state_machine';
import { getMainchainID, isValidName, validNameCharset } from '../utils';
import { RegisteredNamesStore } from '../stores/registered_names';

export class MainchainInteroperabilityModule extends BaseInteroperabilityModule {
	public crossChainMethod = new MainchainCCMethod(this.stores, this.events);
	protected internalMethod = new MainchainInteroperabilityInternalMethod(
		this.stores,
		this.events,
		this.interoperableCCMethods,
	);
	// eslint-disable-next-line @typescript-eslint/member-ordering
	public method = new MainchainInteroperabilityMethod(
		this.stores,
		this.events,
		this.interoperableCCMethods,
		this.internalMethod,
	);
	// eslint-disable-next-line @typescript-eslint/member-ordering
	public endpoint = new MainchainInteroperabilityEndpoint(this.stores, this.offchainStores);

	private readonly _sidechainRegistrationCommand = new RegisterSidechainCommand(
		this.stores,
		this.events,
		this.interoperableCCMethods,
		this.interoperableCCCommands,
		this.internalMethod,
	);

	private readonly _messageRecoveryInitializationCommand = new InitializeMessageRecoveryCommand(
		this.stores,
		this.events,
		this.interoperableCCMethods,
		this.interoperableCCCommands,
		this.internalMethod,
	);
	private readonly _crossChainUpdateCommand = new SubmitMainchainCrossChainUpdateCommand(
		this.stores,
		this.events,
		this.interoperableCCMethods,
		this.interoperableCCCommands,
		this.internalMethod,
	);
	private readonly _messageRecoveryCommand = new RecoverMessageCommand(
		this.stores,
		this.events,
		this.interoperableCCMethods,
		this.interoperableCCCommands,
		this.internalMethod,
	);
	private readonly _stateRecoveryCommand = new RecoverStateCommand(
		this.stores,
		this.events,
		this.interoperableCCMethods,
		this.interoperableCCCommands,
		this.internalMethod,
	);
	private readonly _terminateSidechainForLivenessCommand = new TerminateSidechainForLivenessCommand(
		this.stores,
		this.events,
		this.interoperableCCMethods,
		this.interoperableCCCommands,
		this.internalMethod,
	);

	// eslint-disable-next-line @typescript-eslint/member-ordering
	public commands = [
		this._crossChainUpdateCommand,
		this._messageRecoveryInitializationCommand,
		this._messageRecoveryCommand,
		this._sidechainRegistrationCommand,
		this._stateRecoveryCommand,
		this._terminateSidechainForLivenessCommand,
	];
	// eslint-disable-next-line @typescript-eslint/member-ordering
	public crossChainCommand = [
		new MainchainCCRegistrationCommand(
			this.stores,
			this.events,
			this.interoperableCCMethods,
			this.internalMethod,
		),
		new MainchainCCChannelTerminatedCommand(
			this.stores,
			this.events,
			this.interoperableCCMethods,
			this.internalMethod,
		),
	];

	public constructor() {
		super();
		this.events.register(ChainAccountUpdatedEvent, new ChainAccountUpdatedEvent(this.name));
		this.events.register(CcmProcessedEvent, new CcmProcessedEvent(this.name));
		this.events.register(CcmSendSuccessEvent, new CcmSendSuccessEvent(this.name));
		this.events.register(CcmSentFailedEvent, new CcmSentFailedEvent(this.name));
		this.events.register(
			InvalidRegistrationSignatureEvent,
			new InvalidRegistrationSignatureEvent(this.name),
		);
		this.events.register(TerminatedStateCreatedEvent, new TerminatedStateCreatedEvent(this.name));
		this.events.register(TerminatedOutboxCreatedEvent, new TerminatedOutboxCreatedEvent(this.name));
		this.events.register(
			InvalidCertificateSignatureEvent,
			new InvalidCertificateSignatureEvent(this.name),
		);
	}

	public addDependencies(tokenMethod: TokenMethod, feeMethod: FeeMethod) {
		this._sidechainRegistrationCommand.addDependencies(feeMethod, tokenMethod);
		this._crossChainUpdateCommand.init(this.method, tokenMethod);
		this.internalMethod.addDependencies(tokenMethod);
		this.tokenMethod = tokenMethod;
	}

	public metadata(): ModuleMetadata {
		return {
			...this.baseMetadata(),
			endpoints: [
				{
					name: this.endpoint.getChainAccount.name,
					request: getChainAccountRequestSchema,
					response: chainDataSchema,
				},
				{
					name: this.endpoint.getAllChainAccounts.name,
					request: getChainAccountRequestSchema,
					response: allChainAccountsSchema,
				},
				{
					name: this.endpoint.getChannel.name,
					request: getChannelRequestSchema,
					response: channelSchema,
				},
				{
					name: this.endpoint.getOwnChainAccount.name,
					response: ownChainAccountSchema,
				},
				{
					name: this.endpoint.getTerminatedStateAccount.name,
					request: getTerminatedStateAccountRequestSchema,
					response: terminatedStateSchema,
				},
				{
					name: this.endpoint.getTerminatedOutboxAccount.name,
					request: getTerminatedOutboxAccountRequestSchema,
					response: terminatedOutboxSchema,
				},
				{
					name: this.endpoint.getRegistrationFee.name,
					response: getRegistrationFeeSchema,
				},
				{
					name: this.endpoint.getMinimumMessageFee.name,
					response: getMinimumMessageFeeResponseSchema,
				},
				{
					name: this.endpoint.getChainValidators.name,
					request: getChainValidatorsRequestSchema,
					response: getChainValidatorsResponseSchema,
				},
				{
					name: this.endpoint.isChainIDAvailable.name,
					request: isChainIDAvailableRequestSchema,
					response: isChainIDAvailableResponseSchema,
				},
				{
					name: this.endpoint.isChainNameAvailable.name,
					request: isChainNameAvailableRequestSchema,
					response: isChainNameAvailableResponseSchema,
				},
			],
			assets: [
				{
					version: 0,
					data: genesisInteroperabilitySchema,
				},
			],
		};
	}

	// @see https://github.com/LiskHQ/lips/blob/main/proposals/lip-0045.md#mainchain
	// eslint-disable-next-line @typescript-eslint/require-await
	public async initGenesisState(ctx: GenesisBlockExecuteContext): Promise<void> {
		const genesisBlockAssetBytes = ctx.assets.getAsset(MODULE_NAME_INTEROPERABILITY);
		if (!genesisBlockAssetBytes) {
			return;
		}

		const genesisInteroperability = codec.decode<GenesisInteroperability>(
			genesisInteroperabilitySchema,
			genesisBlockAssetBytes,
		);

		validator.validate<GenesisInteroperability>(
			genesisInteroperabilitySchema,
			genesisInteroperability,
		);

		const {
			ownChainName,
			ownChainNonce,
			chainInfos,
			terminatedStateAccounts,
			terminatedOutboxAccounts,
		} = genesisInteroperability;

		const mainchainID = getMainchainID(ctx.chainID);

		// On the mainchain, the following checks are performed:
		// ownChainName == CHAIN_NAME_MAINCHAIN.
		if (ownChainName !== CHAIN_NAME_MAINCHAIN) {
			throw new Error(`ownChainName must be equal to ${CHAIN_NAME_MAINCHAIN}.`);
		}

		// if chainInfos is empty, then ownChainNonce == 0
		// If chainInfos is non-empty, ownChainNonce > 0
		if (chainInfos.length === 0 && ownChainNonce !== BigInt(0)) {
			throw new Error(`ownChainNonce must be 0 if chainInfos is empty.`);
		} else if (chainInfos.length !== 0 && ownChainNonce <= 0) {
			throw new Error(`ownChainNonce must be positive if chainInfos is not empty.`);
		}

		this._verifyChainInfos(ctx, chainInfos);
		this._verifyTerminatedStateAccounts(chainInfos, terminatedStateAccounts, mainchainID);
		this._verifyTerminatedOutboxAccounts(
			chainInfos,
			terminatedStateAccounts,
			terminatedOutboxAccounts,
		);

		await this.processGenesisState(ctx, genesisInteroperability);
	}

	// https://github.com/LiskHQ/lips/blob/main/proposals/lip-0045.md#mainchain
	private _verifyChainInfos(ctx: GenesisBlockExecuteContext, chainInfos: ChainInfo[]) {
		// Each entry chainInfo in chainInfos has a unique chainInfo.chainID
		const chainIDs = chainInfos.map(info => info.chainID);
		if (!objectUtils.bufferArrayUniqueItems(chainIDs)) {
			throw new Error(`chainInfos doesn't hold unique chainID.`);
		}

		// chainInfos should be ordered lexicographically by chainInfo.chainID
		const sortedByChainID = [...chainInfos].sort((a, b) => a.chainID.compare(b.chainID));
		for (let i = 0; i < chainInfos.length; i += 1) {
			if (!chainInfos[i].chainID.equals(sortedByChainID[i].chainID)) {
				throw new Error('chainInfos is not ordered lexicographically by chainID.');
			}
		}

		// The entries chainData.name must be pairwise distinct
		const chainDataNames = chainInfos.map(info => info.chainData.name);
		if (new Set(chainDataNames).size !== chainDataNames.length) {
			throw new Error(`chainData.name must be pairwise distinct.`);
		}

		const mainchainID = getMainchainID(ctx.chainID);

		// verify root level properties
		for (const chainInfo of chainInfos) {
			this._verifyChainID(chainInfo.chainID, mainchainID, 'chainInfo.');
			this._verifyChainData(ctx, chainInfo);
			this._verifyChannelData(ctx, chainInfo);
			this._verifyChainValidators(chainInfo);
		}
	}

	private _verifyChainData(ctx: GenesisBlockExecuteContext, chainInfo: ChainInfo) {
		const validStatuses = [ChainStatus.REGISTERED, ChainStatus.ACTIVE, ChainStatus.TERMINATED];

		const { chainData } = chainInfo;

		// chainData.lastCertificate.timestamp < g.header.timestamp;
		if (chainData.lastCertificate.timestamp >= ctx.header.timestamp) {
			throw new Error(`chainData.lastCertificate.timestamp must be less than header.timestamp.`);
		}

		// chainData.name only uses the character set a-z0-9!@$&_.;
		if (!isValidName(chainData.name)) {
			throw new Error(`chainData.name only uses the character set ${validNameCharset}.`);
		}

		// chainData.status is in set {CHAIN_STATUS_REGISTERED, CHAIN_STATUS_ACTIVE, CHAIN_STATUS_TERMINATED}.
		if (!validStatuses.includes(chainData.status)) {
			throw new Error(`chainData.status must be one of ${validStatuses.join(', ')}`);
		}
	}

	// https://github.com/LiskHQ/lips/blob/main/proposals/lip-0045.md#mainchain
	private _verifyTerminatedStateAccounts(
		chainInfos: ChainInfo[],
		terminatedStateAccounts: TerminatedStateAccountWithChainID[],
		mainchainID: Buffer,
	) {
		// Sanity check to fulfill if-and-only-if situation
		for (const account of terminatedStateAccounts) {
			const correspondingChainInfo = chainInfos.find(chainInfo =>
				chainInfo.chainID.equals(account.chainID),
			);
			if (
				!correspondingChainInfo ||
				correspondingChainInfo.chainData.status !== ChainStatus.TERMINATED
			) {
				throw new Error(
					'For each terminatedStateAccount there should be a corresponding chainInfo at TERMINATED state.',
				);
			}
		}

		for (const chainInfo of chainInfos) {
			// For each entry chainInfo in chainInfos, chainInfo.chainData.status == CHAIN_STATUS_TERMINATED
			// if and only if a corresponding entry (i.e., with chainID == chainInfo.chainID) exists in terminatedStateAccounts.
			if (chainInfo.chainData.status === ChainStatus.TERMINATED) {
				const terminatedAccount = terminatedStateAccounts.find(tAccount =>
					tAccount.chainID.equals(chainInfo.chainID),
				);
				if (!terminatedAccount) {
					throw new Error(
						'For each chainInfo with status terminated there should be a corresponding entry in terminatedStateAccounts.',
					);
				}

				this._verifyTerminatedStateAccountsCommon(terminatedStateAccounts, mainchainID);

				// For each entry stateAccount in terminatedStateAccounts holds
				// stateAccount.stateRoot == chainData.lastCertificate.stateRoot,
				// stateAccount.mainchainStateRoot == EMPTY_HASH, and
				// stateAccount.initialized == True.
				// Here chainData is the corresponding entry (i.e., with chainID == stateAccount.chainID) in chainInfos.
				const stateAccount = terminatedAccount.terminatedStateAccount;
				if (stateAccount) {
					if (!stateAccount.stateRoot.equals(chainInfo.chainData.lastCertificate.stateRoot)) {
						throw new Error(
							"stateAccount.stateRoot doesn't match chainInfo.chainData.lastCertificate.stateRoot.",
						);
					}

					if (!stateAccount.mainchainStateRoot.equals(EMPTY_HASH)) {
						throw new Error(
							`stateAccount.mainchainStateRoot is not equal to ${EMPTY_HASH.toString('hex')}.`,
						);
					}

					if (!stateAccount.initialized) {
						throw new Error('stateAccount is not initialized.');
					}
				}
			}
		}
	}

	// https://github.com/LiskHQ/lips/blob/main/proposals/lip-0045.md#mainchain
	private _verifyTerminatedOutboxAccounts(
		_chainInfos: ChainInfo[],
		terminatedStateAccounts: TerminatedStateAccountWithChainID[],
		terminatedOutboxAccounts: TerminatedOutboxAccountWithChainID[],
	) {
		// Each entry outboxAccount in terminatedOutboxAccounts has a unique outboxAccount.chainID
		const chainIDs = terminatedOutboxAccounts.map(a => a.chainID);
		if (!objectUtils.bufferArrayUniqueItems(chainIDs)) {
			throw new Error('terminatedOutboxAccounts do not hold unique chainID.');
		}

		// terminatedOutboxAccounts is ordered lexicographically by outboxAccount.chainID
		const sortedByChainID = [...terminatedOutboxAccounts].sort((a, b) =>
			a.chainID.compare(b.chainID),
		);
		for (let i = 0; i < terminatedOutboxAccounts.length; i += 1) {
			if (!terminatedOutboxAccounts[i].chainID.equals(sortedByChainID[i].chainID)) {
				throw new Error('terminatedOutboxAccounts must be ordered lexicographically by chainID.');
			}
		}

		// Furthermore, an entry outboxAccount in terminatedOutboxAccounts must have a corresponding entry
		// (i.e., with chainID == outboxAccount.chainID) in terminatedStateAccounts
		for (const outboxAccount of terminatedOutboxAccounts) {
			if (
				terminatedStateAccounts.find(a => a.chainID.equals(outboxAccount.chainID)) === undefined
			) {
				throw new Error(
					`Each entry outboxAccount in terminatedOutboxAccounts must have a corresponding entry in terminatedStateAccount. outboxAccount with chainID: ${outboxAccount.chainID.toString(
						'hex',
					)} does not exist in terminatedStateAccounts`,
				);
			}
		}
	}

	// https://github.com/LiskHQ/lips/blob/main/proposals/lip-0045.md#genesis-state-processing
	public async processGenesisState(
		ctx: GenesisBlockExecuteContext,
		genesisInteroperability: GenesisInteroperability,
	) {
		await super.processGenesisState(ctx, genesisInteroperability);

		const { chainInfos } = genesisInteroperability;

		// On the mainchain,
		// for each chainInfo in chainInfos add an entry to the registered names substore
		// with key chainInfo.chainData.name and value chainInfo.chainID.
		// , Furthermore add an entry for the mainchain with key CHAIN_NAME_MAINCHAIN and value getMainchainID().
		const namesSubStore = this.stores.get(RegisteredNamesStore);
		for (const chainInfo of chainInfos) {
			await namesSubStore.set(ctx, Buffer.from(chainInfo.chainData.name, 'ascii'), {
				chainID: chainInfo.chainID,
			});
		}
		await namesSubStore.set(ctx, Buffer.from(CHAIN_NAME_MAINCHAIN, 'ascii'), {
			chainID: getMainchainID(ctx.chainID),
		});
	}
}
