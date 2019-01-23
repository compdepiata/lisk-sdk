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

/**
 * The purpose of the PeerPool is to provide a simple interface for selecting,
 * interacting with and handling aggregated events from a collection of peers.
 */

import { EventEmitter } from 'events';

import {
	ConnectionState,
	EVENT_CONNECT_ABORT_OUTBOUND,
	EVENT_CONNECT_OUTBOUND,
	EVENT_MESSAGE_RECEIVED,
	EVENT_REQUEST_RECEIVED,
	Peer,
	PeerInfo,
	REMOTE_RPC_GET_ALL_PEERS_LIST,
} from './peer';
import { discoverPeers } from './peer_discovery';
import {
	PeerOptions,
	selectForConnection,
	selectPeers,
} from './peer_selection';

import { SCServerSocket } from 'socketcluster-server';
import { P2PRequest } from './p2p_request';
import { P2PMessagePacket, P2PNodeInfo } from './p2p_types';

export { EVENT_CONNECT_OUTBOUND, EVENT_CONNECT_ABORT_OUTBOUND, EVENT_REQUEST_RECEIVED, EVENT_MESSAGE_RECEIVED };

export class PeerPool extends EventEmitter {
	private readonly _peerMap: Map<string, Peer>;
	private readonly _handlePeerRPC: (request: P2PRequest) => void;
	private readonly _handlePeerMessage: (message: P2PMessagePacket) => void;
	private readonly _handlePeerConnect: (peerInfo: PeerInfo) => void;
	private readonly _handlePeerConnectAbort: (peerInfo: PeerInfo) => void;

	public constructor() {
		super();
		this._peerMap = new Map();

		// This needs to be an arrow function so that it can be used as a listener.
		this._handlePeerRPC = (request: P2PRequest) => {
			if (request.procedure === REMOTE_RPC_GET_ALL_PEERS_LIST) {
				// The PeerPool has the necessary information to handle this request on its own.
				// This request doesn't need to propagate to its parent class.
				this._handleGetAllPeersRequest(request);

				return;
			}

			// Re-emit the request to allow it to bubble up the class hierarchy.
			this.emit(EVENT_REQUEST_RECEIVED, request);
		};

		// This needs to be an arrow function so that it can be used as a listener.
		this._handlePeerMessage = (message: P2PMessagePacket) => {
			// Re-emit the message to allow it to bubble up the class hierarchy.
			this.emit(EVENT_MESSAGE_RECEIVED, message);
		};
		this._handlePeerConnect = (peerInfo: PeerInfo) => {
			// Re-emit the message to allow it to bubble up the class hierarchy.
			this.emit(EVENT_CONNECT_OUTBOUND, peerInfo);
		};
		this._handlePeerConnectAbort = (peerInfo: PeerInfo) => {
			// Re-emit the message to allow it to bubble up the class hierarchy.
			this.emit(EVENT_CONNECT_ABORT_OUTBOUND, peerInfo);
		};
	}

	public selectPeers(
		selectionParams: PeerOptions,
		numOfPeers?: number,
	): ReadonlyArray<Peer> {
		const selectedPeers = selectPeers(
			[...this._peerMap.values()],
			selectionParams,
			numOfPeers,
		);

		return selectedPeers;
	}

	public async runDiscovery(
		peers: ReadonlyArray<PeerInfo>,
		blacklist: ReadonlyArray<PeerInfo>,
	): Promise<ReadonlyArray<PeerInfo>> {
		const peersObjectList = peers.map((peerInfo: PeerInfo) => {
			const peer = new Peer(peerInfo);
			this.addPeer(peer); // Binding of events will be done in addPeer

			return peer;
		});

		const disoveredPeers = await discoverPeers(peersObjectList, {
			blacklist: blacklist.map(peer => peer.ipAddress),
		});

		return disoveredPeers;
	}

	public connectToPeers(
		peers: ReadonlyArray<PeerInfo>,
	): ReadonlyArray<PeerInfo> {
		const availablePeers = Array.from(peers).map(
			(peerInfo: PeerInfo) => new Peer(peerInfo),
		);
		const peersToConnect = selectForConnection(availablePeers);

		const connectedPeerInfo = peersToConnect.map((peer: Peer) => {
			this.addPeer(peer);

			return peer.peerInfo; // Return peerInfo to p2p to manage new/tried Peers
		});

		return connectedPeerInfo;
	}

	public addPeer(peer: Peer): void {
		this._peerMap.set(peer.id, peer);
		this._bindHandlersToPeer(peer);
		peer.connect();
	}

	public addInboundPeer(
		peerId: string,
		peerinfo: PeerInfo,
		socket: SCServerSocket,
		nodeInfo: P2PNodeInfo,
	): boolean {
		const existingPeer = this.getPeer(peerId);

		if (existingPeer) {
			if (existingPeer.state.inbound === ConnectionState.DISCONNECTED) {
				existingPeer.inboundSocket = socket;

				return false;
			}

			return false;
		}

		const peer = new Peer({ ...peerinfo }, socket);

		peer.applyNodeInfo(nodeInfo);
		this.addPeer(peer);

		return true;
	}

	public removeAllPeers(): void {
		this._peerMap.forEach((peer: Peer) => {
			this.removePeer(peer.id);
		});
	}

	public getAllPeerInfos(): ReadonlyArray<PeerInfo> {
		return this.getAllPeers().map(peer => peer.peerInfo);
	}

	public getAllPeers(): ReadonlyArray<Peer> {
		return [...this._peerMap.values()];
	}

	public getPeer(peerId: string): Peer | undefined {
		return this._peerMap.get(peerId);
	}

	public hasPeer(peerId: string): boolean {
		return this._peerMap.has(peerId);
	}

	public removePeer(peerId: string): boolean {
		const peer = this._peerMap.get(peerId);
		if (peer) {
			peer.disconnect();
			this._unbindHandlersFromPeer(peer);
		}

		return this._peerMap.delete(peerId);
	}

	private _handleGetAllPeersRequest(request: P2PRequest): void {
		request.end(this.getAllPeerInfos());
	}

	private _bindHandlersToPeer(peer: Peer): void {
		peer.on(EVENT_REQUEST_RECEIVED, this._handlePeerRPC);
		peer.on(EVENT_MESSAGE_RECEIVED, this._handlePeerMessage);
		peer.on(EVENT_CONNECT_OUTBOUND, this._handlePeerConnect);
		peer.on(EVENT_CONNECT_ABORT_OUTBOUND, this._handlePeerConnectAbort);
	}

	private _unbindHandlersFromPeer(peer: Peer): void {
		peer.off(EVENT_REQUEST_RECEIVED, this._handlePeerRPC);
		peer.off(EVENT_MESSAGE_RECEIVED, this._handlePeerMessage);
		peer.off(EVENT_CONNECT_OUTBOUND, this._handlePeerConnect);
		peer.off(EVENT_CONNECT_ABORT_OUTBOUND, this._handlePeerConnectAbort);
	}
}
