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

import { ImmutableAPIContext } from '../../state_machine';
import { BaseAPI } from '../base_api';
import { MAX_LENGTH_NAME } from './constants';
import { DelegateStore } from './stores/delegate';
import { NameStore } from './stores/name';
import { VoterStore } from './stores/voter';
import { DelegateAccount, VoterData } from './types';
import { isUsername } from './utils';

export class DPoSAPI extends BaseAPI {
	public async isNameAvailable(apiContext: ImmutableAPIContext, name: string): Promise<boolean> {
		const nameSubStore = this.stores.get(NameStore);
		if (name.length > MAX_LENGTH_NAME || name.length < 1 || !isUsername(name)) {
			return false;
		}

		const isRegistered = await nameSubStore.has(apiContext, Buffer.from(name));
		if (isRegistered) {
			return false;
		}

		return true;
	}

	public async getVoter(apiContext: ImmutableAPIContext, address: Buffer): Promise<VoterData> {
		const voterSubStore = this.stores.get(VoterStore);
		const voterData = await voterSubStore.get(apiContext, address);

		return voterData;
	}

	public async getDelegate(
		apiContext: ImmutableAPIContext,
		address: Buffer,
	): Promise<DelegateAccount> {
		const delegateSubStore = this.stores.get(DelegateStore);
		const delegate = await delegateSubStore.get(apiContext, address);

		return delegate;
	}
}
