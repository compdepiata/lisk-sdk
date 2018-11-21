/*
 * Copyright © 2018 Lisk Foundation
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
 *
 */
import { BaseTransaction } from './base_transaction';

export interface IAccount {
	readonly address: string;
	readonly balance: string;
	readonly delegate: IDelegate;
	readonly publicKey: string;
	readonly secondPublicKey?: string;
	readonly unconfirmedBalance: string;
}

export interface IDelegate {
	readonly approval: number;
	readonly missedBlocks: number;
	readonly producedBlocks: number;
	readonly productivity: number;
	readonly rank: number;
	readonly rewards: number;
	readonly username: string;
	readonly vote: string;
}

export interface IRequiredState {
	readonly accounts: ReadonlyArray<IAccount>;
	readonly transactions: ReadonlyArray<ITransactionJSON>;
}

export interface ITransactionJSON {
	readonly amount: string;
	readonly asset?: TransactionAsset;
	readonly fee: string;
	readonly id: string;
	readonly recipientId: string;
	readonly recipientPublicKey: string;
	readonly senderId: string;
	readonly senderPublicKey: string;
	readonly signature: string;
	readonly signatures?: ReadonlyArray<string>;
	readonly signSignature?: string;
	readonly timestamp: number;
	readonly type: number;
}

export type TransactionAsset =
	| TransferAsset
	| SecondSignatureAsset
	| DelegateAsset
	| VoteAsset
	| MultiSignatureAsset
	| DappAsset
	| InTransferAsset
	| OutTransferAsset;

export interface TransferTransaction extends BaseTransaction {
	readonly asset: TransferAsset;
}

export interface TransferAsset {
	readonly data?: string;
}

export interface SecondSignatureTransaction extends BaseTransaction {
	readonly asset: SecondSignatureAsset;
}

export interface SecondSignatureAsset {
	readonly signature: {
		readonly publicKey: string;
	};
}

export interface DelegateTransaction extends BaseTransaction {
	readonly asset: DelegateAsset;
}

export interface DelegateAsset {
	readonly delegate: {
		readonly username: string;
	};
}

export interface VoteTransaction extends BaseTransaction {
	readonly asset: VoteAsset;
}

export interface VoteAsset {
	readonly votes: ReadonlyArray<string>;
}

export interface MultiSignatureTransaction extends BaseTransaction {
	readonly asset: MultiSignatureAsset;
}

export interface MultiSignatureAsset {
	readonly multisignature: {
		readonly keysgroup: ReadonlyArray<string>;
		readonly lifetime: number;
		readonly min: number;
	};
}

export interface DappTransaction extends BaseTransaction {
	readonly asset: DappAsset;
}

export interface DappAsset {
	readonly dapp: {
		readonly category: number;
		readonly description?: string;
		readonly icon?: string;
		readonly link: string;
		readonly name: string;
		readonly tags?: string;
		readonly type: number;
	};
}

export interface InTransferTransaction extends BaseTransaction {
	readonly asset: InTransferAsset;
}

export interface InTransferAsset {
	readonly inTransfer: {
		readonly dappId: string;
	};
}

export interface OutTransferTransaction extends BaseTransaction {
	readonly asset: OutTransferAsset;
}

export interface OutTransferAsset {
	readonly outTransfer: {
		readonly dappId: string;
		readonly transactionId: string;
	};
}
