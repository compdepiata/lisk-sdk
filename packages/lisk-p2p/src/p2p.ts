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

import { EventEmitter } from 'events';
import http, { Server } from 'http';
import { platform } from 'os';
import querystring from 'querystring';
import { attach, SCServer, SCServerSocket } from 'socketcluster-server';

import { Peer, PeerInfo } from './peer';

import {
	P2PConfig,
	P2PMessagePacket,
	P2PNetworkStatus,
	P2PNodeInfo,
	P2PPenalty,
	P2PRequestPacket,
	P2PResponsePacket,
	ProtocolPeerInfo,
	ProtocolPeerList,
} from './p2p_types';

type SCServerCloseCallback = () => void;

type SCServerUpdated = {
	readonly close: (sCServerCloseCallback: SCServerCloseCallback) => void;
} & SCServer;

import { PeerPool } from './peer_pool';

export const EVENT_NEW_INBOUND_PEER = 'newInboundPeer';
export const EVENT_FAILED_TO_ADD_INBOUND_PEER = 'failedToAddInboundPeer';
export const EVENT_NEW_PEER = 'newPeer';

const BASE_10_RADIX = 10;

export class P2P extends EventEmitter {
	private readonly _config: P2PConfig;
	private readonly _httpServer: Server;
	private _isActive: boolean;
	private readonly _newPeers: Set<PeerInfo>;

	// TODO ASAP: private readonly _triedPeers: Set<PeerInfo>;
	private _nodeInfo: P2PNodeInfo;
	private readonly _peerPool: PeerPool;
	private readonly _scServer: SCServerUpdated;

	public constructor(config: P2PConfig) {
		super();
		this._config = config;
		this._nodeInfo = {
			wsPort: config.wsPort,
			os: platform(),
			version: config.version,
			height: 0,
		};
		this._isActive = false;
		this._newPeers = new Set();
		// TODO ASAP: this._triedPeers = new Set();

		this._peerPool = new PeerPool();
		this._httpServer = http.createServer();
		this._scServer = attach(this._httpServer) as SCServerUpdated;
	}

	public get isActive(): boolean {
		return this._isActive;
	}

	public get nodeInfo(): P2PNodeInfo {
		return this._nodeInfo;
	}

	/**
	 * This is not a declared as a setter because this method will need
	 * invoke an async RPC on Peers to give them our new node status.
	 */
	public applyNodeInfo(nodeInfo: P2PNodeInfo): void {
		this._nodeInfo = nodeInfo;
		const peerList = this._peerPool.getAllPeers();
		peerList.forEach(peer => {
			peer.applyNodeInfo(nodeInfo);
		});
	}

	/* tslint:disable:next-line: prefer-function-over-method */
	public applyPenalty(penalty: P2PPenalty): void {
		penalty;
	}

	public getNetworkStatus(): P2PNetworkStatus {
		// TODO ASAP: Add additional properties such as _triedPeers.
		return {
			newPeers: [...this._newPeers.values()],
			activePeers: this._peerPool.getAllPeerInfos(),
		};
	}

	/* tslint:disable:next-line: prefer-function-over-method */
	public async request<T>(
		packet: P2PRequestPacket<T>,
	): Promise<P2PResponsePacket> {
		// TODO ASAP
		return Promise.resolve({ data: packet });
	}

	/* tslint:disable:next-line: prefer-function-over-method */
	public send<T>(message: P2PMessagePacket<T>): void {
		message;
		// TODO ASAP
	}

	private async _startPeerServer(): Promise<void> {
		this._scServer.on(
			'connection',
			(socket: SCServerSocket): void => {
				if (!socket.request.url) {
					super.emit(EVENT_FAILED_TO_ADD_INBOUND_PEER);

					return;
				}
				const queryObject = querystring.parse(socket.request.url);
				if (
					typeof queryObject.wsPort !== 'string' ||
					typeof queryObject.os !== 'string' ||
					typeof queryObject.version !== 'string'
				) {
					super.emit(EVENT_FAILED_TO_ADD_INBOUND_PEER);
				} else {
					const wsPort: number = parseInt(queryObject.wsPort, BASE_10_RADIX);
					const peerId = Peer.constructPeerId(socket.remoteAddress, wsPort);
					const existingPeer = this._peerPool.getPeer(peerId);
					if (existingPeer === undefined) {
						const peer = new Peer({
							inboundSocket: socket,
							ipAddress: socket.remoteAddress,
							os: queryObject.os,
							version: queryObject.version,
							wsPort,
						});
						peer.applyNodeInfo(this._nodeInfo);
						this._peerPool.addPeer(peer);
						super.emit(EVENT_NEW_INBOUND_PEER, peer);
						super.emit(EVENT_NEW_PEER, peer);
						this._newPeers.add(peer.peerInfo);
					} else {
						existingPeer.inboundSocket = socket;
						this._newPeers.add(existingPeer.peerInfo);
					}
				}
			},
		);
		this._httpServer.listen(this._config.wsPort);

		return new Promise<void>(resolve => {
			this._scServer.once('ready', () => {
				this._isActive = true;
				resolve();
			});
		});
	}

	private async _stopPeerServer(): Promise<void> {
		// TODO ASAP: Test this and check for potential failure scenarios.
		return new Promise<void>(resolve => {
			this._scServer.close(() => {
				this._isActive = false;
				resolve();
			});
		});
	}

	// TODO ASAP: This should be refactored to use the discovery function.
	private async _loadListOfPeerListsFromSeeds(
		seedList: ReadonlyArray<PeerInfo>,
	): Promise<ReadonlyArray<ReadonlyArray<Peer>>> {
		return Promise.all(
			seedList.map(async (seedPeerInfo: PeerInfo) => {
				const seedPeer = new Peer(seedPeerInfo);
				seedPeer.applyNodeInfo(this._nodeInfo);
				this._newPeers.add(seedPeer.peerInfo);
				/**
				 * TODO later: For the LIP phase, we shouldn't add the seed peers to our
				 * _peerPool and we should disconnect from them as soon as we've loaded their peer lists.
				 */
				this._peerPool.addPeer(seedPeer);
				// TODO later: For the LIP phase, the 'list' request will need to be renamed.
				const seedNodePeerListResponse = await seedPeer.request<void>({
					procedure: 'list',
				});
				const peerListResponse = seedNodePeerListResponse.data as ProtocolPeerList;
				
				// TODO ASAP: Validate the response before returning. Check that seedNodePeerListResponse.data.peers exists.

				return peerListResponse.peers.map((peerInfo: ProtocolPeerInfo) => {
					const peer = new Peer({
						ipAddress: peerInfo.ip,
						wsPort: peerInfo.wsPort, // TODO ASAP: Add more properties
						height: peerInfo.height,
						os: peerInfo.os,
						version: peerInfo.version,
					});
					peer.applyNodeInfo(this._nodeInfo);

					return peer;
				});
			}),
		);
	}

	public async start(): Promise<void> {
		await this._startPeerServer();
		await this._loadListOfPeerListsFromSeeds(this._config.seedPeers);
	}

	public async stop(): Promise<void> {
		this._peerPool.disconnectAllPeers();
		await this._stopPeerServer();
	}
}
