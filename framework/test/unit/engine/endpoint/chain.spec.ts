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

import { Event } from '@liskhq/lisk-chain';
import { utils } from '@liskhq/lisk-cryptography';
import { ChainEndpoint } from '../../../../src/engine/endpoint/chain';
import { PrefixedStateReadWriter } from '../../../../src/state_machine/prefixed_state_read_writer';
import { InMemoryPrefixedStateDB } from '../../../../src/testing/in_memory_prefixed_state';
import { createContext } from '../../../utils/mocks/endpoint';

describe('Chain endpoint', () => {
	let stateStore: PrefixedStateReadWriter;
	let endpoint: ChainEndpoint;

	beforeEach(() => {
		stateStore = new PrefixedStateReadWriter(new InMemoryPrefixedStateDB());
		endpoint = new ChainEndpoint({
			chain: {
				dataAccess: {
					getEvents: jest.fn(),
				},
			} as any,
		});
	});

	describe('getEvents', () => {
		beforeEach(() => {
			jest.spyOn(endpoint['_chain'].dataAccess, 'getEvents').mockResolvedValue([
				new Event({
					index: 0,
					module: 'token',
					topics: [utils.getRandomBytes(32)],
					typeID: Buffer.from([0, 0, 0, 1]),
					data: utils.getRandomBytes(32),
				}),
				new Event({
					index: 1,
					module: 'token',
					topics: [utils.getRandomBytes(32)],
					typeID: Buffer.from([0, 0, 0, 1]),
					data: utils.getRandomBytes(32),
				}),
			]);
		});

		it('should reject if height is not number', async () => {
			await expect(
				endpoint.getEvents(createContext(stateStore, { height: 'null' })),
			).rejects.toThrow('Invalid parameters. height must be zero or a positive number');
		});

		it('should reject if height is a negative number', async () => {
			await expect(endpoint.getEvents(createContext(stateStore, { height: -1 }))).rejects.toThrow(
				'Invalid parameters. height must be zero or a positive number',
			);
		});

		it('should return all events', async () => {
			const events = await endpoint.getEvents(createContext(stateStore, { height: 30 }));
			expect(events).toHaveLength(2);
			expect(events[0]).toEqual({
				index: 0,
				module: 'token',
				topics: [expect.any(String)],
				typeID: '00000001',
				data: expect.any(String),
			});
		});
	});

	describe('proveEvents', () => {
		beforeEach(() => {
			jest.spyOn(endpoint['_chain'].dataAccess, 'getEvents').mockResolvedValue([
				new Event({
					index: 0,
					module: 'transfer',
					topics: [utils.getRandomBytes(32)],
					typeID: Buffer.from([0, 0, 0, 1]),
					data: utils.getRandomBytes(32),
				}),
				new Event({
					index: 1,
					module: 'transfer',
					topics: [utils.getRandomBytes(32)],
					typeID: Buffer.from([0, 0, 0, 1]),
					data: utils.getRandomBytes(32),
				}),
			]);
		});

		it('should reject if height is not number', async () => {
			await expect(
				endpoint.proveEvents(createContext(stateStore, { height: 'null' })),
			).rejects.toThrow(".height' should be of type 'integer'");
		});

		it('should reject if height is a negative number', async () => {
			await expect(endpoint.proveEvents(createContext(stateStore, { height: -1 }))).rejects.toThrow(
				'must be >= 0',
			);
		});

		it('should reject if query contains non hex string', async () => {
			await expect(
				endpoint.proveEvents(createContext(stateStore, { height: 0, queries: ['zzzzz'] })),
			).rejects.toThrow('must match format "hex"');
		});

		it('should return proof', async () => {
			const randomQuery = '453c17c88e72841d5f6974711d947ffde52290daa4e906aeea460ef7871efa93';
			const resp = await endpoint.proveEvents(
				createContext(stateStore, { height: 0, queries: [randomQuery] }),
			);

			expect(resp.queries).toHaveLength(1);
			expect(resp.siblingHashes).toHaveLength(1);
		});
	});
});
