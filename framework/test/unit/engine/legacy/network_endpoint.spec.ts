/* eslint-disable max-classes-per-file */
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
import { utils } from '@liskhq/lisk-cryptography';
import { Block } from '@liskhq/lisk-chain';
import { Database, InMemoryDatabase } from '@liskhq/lisk-db';
import { codec } from '@liskhq/lisk-codec';
import { LegacyNetworkEndpoint } from '../../../../src/engine/legacy/network_endpoint';
import { loggerMock } from '../../../../src/testing/mocks';
import { Network } from '../../../../src/engine/network';
import {
	getBlocksFromIdRequestSchema,
	getBlocksFromIdResponseSchema,
} from '../../../../src/engine/consensus/schema';

import { getLegacyBlocksRangeV2 } from './fixtures';
import { decodeBlock, encodeBlock } from '../../../../src/engine/legacy/codec';

describe('Legacy P2P network endpoint', () => {
	const defaultPeerID = 'peer-id';

	let network: Network;
	let db: Database;
	let endpoint: LegacyNetworkEndpoint;

	beforeEach(() => {
		network = {
			applyPenaltyOnPeer: jest.fn(),
		} as unknown as Network;
		db = new InMemoryDatabase() as unknown as Database;

		endpoint = new LegacyNetworkEndpoint({
			logger: loggerMock,
			network,
			db,
		});
	});

	afterAll(() => {
		db.close();
	});

	describe('handleRPCGetLegacyBlocksFromId', () => {
		afterEach(async () => {
			await db.clear();
		});

		it('should apply penalty on the peer when data format is invalid', async () => {
			const invalidBytes = Buffer.from([244, 21, 21]);
			await expect(
				endpoint.handleRPCGetLegacyBlocksFromID(invalidBytes, defaultPeerID),
			).rejects.toThrow();
			expect(network.applyPenaltyOnPeer).toHaveBeenCalledTimes(1);
		});

		it("should return empty list if ID doesn't exist", async () => {
			const blockId = utils.getRandomBytes(32);
			const blockIds = codec.encode(getBlocksFromIdRequestSchema, {
				blockId,
			});
			const blocks = await endpoint.handleRPCGetLegacyBlocksFromID(blockIds, defaultPeerID);
			expect(blocks).toEqual(codec.encode(getBlocksFromIdResponseSchema, { blocks: [] }));
		});

		it('should return 100 blocks from the requested ID', async () => {
			const startHeight = 110;
			// 100 blocks including the requested block ID
			const blocks = getLegacyBlocksRangeV2(startHeight, 99);

			const requestedBlock = decodeBlock(blocks[0]).block;

			const {
				header: { id, ...blockHeader },
				payload,
			} = requestedBlock;

			const requestedBlockWithoutID = { header: { ...blockHeader }, payload };

			const encodedBlockWithoutID = encodeBlock(requestedBlockWithoutID);
			const requestedBlockID = utils.hash(encodedBlockWithoutID);

			// Save blocks to the database
			for (let i = 0; i < blocks.length; i += 1) {
				const block = blocks[i];
				await endpoint['_storage'].saveBlock(utils.hash(block), startHeight + i, block);
			}

			const encodedRequest = codec.encode(getBlocksFromIdRequestSchema, {
				blockId: requestedBlockID,
			} as never);
			const blocksReceived = await endpoint.handleRPCGetLegacyBlocksFromID(
				encodedRequest,
				defaultPeerID,
			);
			expect(
				codec.decode<{ blocks: Block[] }>(getBlocksFromIdResponseSchema, blocksReceived).blocks,
			).toHaveLength(100);
		});
	});
});
