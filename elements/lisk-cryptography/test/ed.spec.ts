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
 *
 */
import { makeInvalid } from './helpers';
import {
	SignedMessageWithOnePassphrase,
	signMessageWithPassphrase,
	verifyMessageWithPublicKey,
	printSignedMessage,
	signAndPrintMessage,
	signData,
	signDataWithPassphrase,
	signDataWithPrivateKey,
	verifyData,
	getKeyPairFromPhraseAndPath,
	getPublicKeyFromPrivateKey,
	getPrivateAndPublicKeyFromPassphrase,
	getKeys,
} from '../src/ed';
import { createMessageTag } from '../src/utils';
import { MAX_UINT32 } from '../src/constants';
import * as address from '../src/address';
import { Keypair } from '../src/types';

const changeLength = (buffer: Buffer): Buffer => Buffer.concat([Buffer.from('00', 'hex'), buffer]);

describe('sign', () => {
	const tag = createMessageTag('TST');
	const networkIdentifier = Buffer.from(
		'30c7a5df2ed79994178c10ac168d6d977ef45cd525e95b7a86244bbd4eb455',
		'hex',
	);
	const defaultPassphrase = 'minute omit local rare sword knee banner pair rib museum shadow juice';
	const defaultPrivateKey =
		'314852d7afb0d4c283692fef8a2cb40e30c7a5df2ed79994178c10ac168d6d977ef45cd525e95b7a86244bbd4eb4550914ad06301013958f4dd64d32ef7bc588';
	const defaultPublicKey = '7ef45cd525e95b7a86244bbd4eb4550914ad06301013958f4dd64d32ef7bc588';
	const defaultMessage = 'Some default text.';
	const defaultSignature =
		'68937004b6720d7e1902ef05a577e6d9f9ab2756286b1f2ae918f8a0e5153c15e4f410916076f750b708f8979be2430e4cfc7ebb523ae1905d2ea1f5d24ce700';
	const defaultPrintedMessage = `
-----BEGIN LISK SIGNED MESSAGE-----
-----MESSAGE-----
${defaultMessage}
-----PUBLIC KEY-----
${defaultPublicKey}
-----SIGNATURE-----
${defaultSignature}
-----END LISK SIGNED MESSAGE-----
`.trim();

	const defaultData = Buffer.from('This is some data');
	const defaultDataSignature =
		'be3167eb1bd0b1e37727872a7eaee78a7ec13386d23dc50e7ef589ff0e50d680bc8e039072790b875820b25ea7129a8b6c98850951515fac5cfa56119ce43e00';

	let defaultSignedMessage: SignedMessageWithOnePassphrase;

	beforeEach(() => {
		defaultSignedMessage = {
			message: defaultMessage,
			publicKey: Buffer.from(defaultPublicKey, 'hex'),
			signature: Buffer.from(defaultSignature, 'hex'),
		};

		jest.spyOn(address, 'getAddressAndPublicKeyFromPassphrase').mockImplementation(() => {
			return {
				address: address.getAddressFromPublicKey(Buffer.from(defaultPublicKey, 'hex')),
				privateKey: Buffer.from(defaultPrivateKey, 'hex'),
				publicKey: Buffer.from(defaultPublicKey, 'hex'),
			};
		});
	});

	describe('#signMessageWithPassphrase', () => {
		it('should create a signed message using a secret passphrase', () => {
			const signedMessage = signMessageWithPassphrase(defaultMessage, defaultPassphrase);
			expect(signedMessage).toEqual(defaultSignedMessage);
		});
	});

	describe('#getPrivateAndPublicKeyFromPassphrase', () => {
		let keyPair: Keypair;

		beforeEach(() => {
			keyPair = getPrivateAndPublicKeyFromPassphrase(defaultPassphrase);
		});

		it('should generate the correct publicKey from a passphrase', () => {
			expect(keyPair).toHaveProperty('publicKey', Buffer.from(defaultPublicKey, 'hex'));
		});

		it('should generate the correct privateKey from a passphrase', () => {
			expect(keyPair).toHaveProperty('privateKey', Buffer.from(defaultPrivateKey, 'hex'));
		});
	});

	describe('#getKeys', () => {
		let keyPair: Keypair;

		beforeEach(() => {
			keyPair = getKeys(defaultPassphrase);
		});

		it('should generate the correct publicKey from a passphrase', () => {
			expect(keyPair).toHaveProperty('publicKey', Buffer.from(defaultPublicKey, 'hex'));
		});

		it('should generate the correct privateKey from a passphrase', () => {
			expect(keyPair).toHaveProperty('privateKey', Buffer.from(defaultPrivateKey, 'hex'));
		});
	});

	describe('#verifyMessageWithPublicKey', () => {
		it('should detect invalid publicKeys', () => {
			expect(
				verifyMessageWithPublicKey.bind(null, {
					message: defaultMessage,
					signature: Buffer.from(defaultSignature, 'hex'),
					publicKey: changeLength(Buffer.from(defaultPublicKey, 'hex')),
				}),
			).toThrow('Invalid publicKey, expected 32-byte publicKey');
		});

		it('should detect invalid signatures', () => {
			expect(
				verifyMessageWithPublicKey.bind(null, {
					message: defaultMessage,
					signature: changeLength(Buffer.from(defaultSignature, 'hex')),
					publicKey: Buffer.from(defaultPublicKey, 'hex'),
				}),
			).toThrow('Invalid signature length, expected 64-byte signature');
		});

		it('should return false if the signature is invalid', () => {
			const verification = verifyMessageWithPublicKey({
				message: defaultMessage,
				signature: makeInvalid(Buffer.from(defaultSignature, 'hex')),
				publicKey: Buffer.from(defaultPublicKey, 'hex'),
			});
			expect(verification).toBe(false);
		});

		it('should return true if the signature is valid', () => {
			const verification = verifyMessageWithPublicKey(defaultSignedMessage);
			expect(verification).toBe(true);
		});
	});

	describe('#printSignedMessage', () => {
		it('should wrap a single signed message into a printed Lisk template', () => {
			const printedMessage = printSignedMessage({
				message: defaultMessage,
				signature: Buffer.from(defaultSignature, 'hex'),
				publicKey: Buffer.from(defaultPublicKey, 'hex'),
			});
			expect(printedMessage).toBe(defaultPrintedMessage);
		});
	});

	describe('#signAndPrintMessage', () => {
		it('should sign the message once and wrap it into a printed Lisk template', () => {
			const signedAndPrintedMessage = signAndPrintMessage(defaultMessage, defaultPassphrase);
			expect(signedAndPrintedMessage).toBe(defaultPrintedMessage);
		});
	});

	describe('#signData', () => {
		let signature: Buffer;

		beforeEach(async () => {
			signature = signData(tag, networkIdentifier, defaultData, defaultPassphrase);
			return Promise.resolve();
		});

		it('should sign a transaction', () => {
			expect(signature).toEqual(Buffer.from(defaultDataSignature, 'hex'));
		});
	});

	describe('#signDataWithPassphrase', () => {
		let signature: Buffer;

		beforeEach(async () => {
			signature = signDataWithPassphrase(tag, networkIdentifier, defaultData, defaultPassphrase);
			return Promise.resolve();
		});

		it('should sign a transaction', () => {
			expect(signature).toEqual(Buffer.from(defaultDataSignature, 'hex'));
		});
	});

	describe('#signDataWithPrivateKey', () => {
		let signature: Buffer;

		beforeEach(async () => {
			signature = signDataWithPrivateKey(
				tag,
				networkIdentifier,
				defaultData,
				Buffer.from(defaultPrivateKey, 'hex'),
			);
			return Promise.resolve();
		});

		it('should sign a transaction', () => {
			expect(signature).toEqual(Buffer.from(defaultDataSignature, 'hex'));
		});
	});

	describe('#verifyData', () => {
		it('should return false for an invalid signature', () => {
			const verification = verifyData(
				tag,
				networkIdentifier,
				defaultData,
				makeInvalid(Buffer.from(defaultDataSignature, 'hex')),
				Buffer.from(defaultPublicKey, 'hex'),
			);
			expect(verification).toBe(false);
		});

		it('should return true for a valid signature', () => {
			const verification = verifyData(
				tag,
				networkIdentifier,
				defaultData,
				Buffer.from(defaultDataSignature, 'hex'),
				Buffer.from(defaultPublicKey, 'hex'),
			);
			expect(verification).toBe(true);
		});
	});

	describe('getKeyPairFromPhraseAndPath', () => {
		const passphrase =
			'target cancel solution recipe vague faint bomb convince pink vendor fresh patrol';
		it('should get keypair from valid phrase and path', async () => {
			const privateKey = await getKeyPairFromPhraseAndPath(passphrase, `m/44'/134'/0'`);
			const publicKey = getPublicKeyFromPrivateKey(privateKey);
			expect(publicKey.toString('hex')).toBe(
				'c6bae83af23540096ac58d5121b00f33be6f02f05df785766725acdd5d48be9d',
			);
			expect(privateKey.toString('hex')).toBe(
				'c465dfb15018d3aef0d94d411df048e240e87a3ec9cd6d422cea903bfc101f61c6bae83af23540096ac58d5121b00f33be6f02f05df785766725acdd5d48be9d',
			);
		});

		it('should fail for empty string path', async () => {
			await expect(getKeyPairFromPhraseAndPath(passphrase, '')).rejects.toThrow(
				'Invalid path format',
			);
		});

		it('should fail if path does not start with "m"', async () => {
			await expect(getKeyPairFromPhraseAndPath(passphrase, `/44'/134'/0'`)).rejects.toThrow(
				'Invalid path format',
			);
		});

		it('should fail if path does not include at least one "/"', async () => {
			await expect(getKeyPairFromPhraseAndPath(passphrase, 'm441340')).rejects.toThrow(
				'Invalid path format',
			);
		});

		it('should fail for path with invalid segment', async () => {
			await expect(
				getKeyPairFromPhraseAndPath(
					passphrase,
					`m//134'/0'`, // should be number with or without ' between every back slash
				),
			).rejects.toThrow('Invalid path format');
		});

		it('should fail for path with invalid characters', async () => {
			await expect(getKeyPairFromPhraseAndPath(passphrase, `m/a'/134b'/0'`)).rejects.toThrow(
				'Invalid path format',
			);
		});

		it('should fail for path with non-sanctioned special characters', async () => {
			await expect(getKeyPairFromPhraseAndPath(passphrase, `m/4a'/#134b'/0'`)).rejects.toThrow(
				'Invalid path format',
			);
		});

		it(`should fail for path with segment greater than ${MAX_UINT32} / 2`, async () => {
			await expect(
				getKeyPairFromPhraseAndPath(passphrase, `m/44'/134'/${MAX_UINT32}'`),
			).rejects.toThrow('Invalid path format');
		});
	});
});
