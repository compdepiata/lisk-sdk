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
import {
	isHexString,
	isBase64String,
	isNumberString,
	isSInt64,
	isUInt64,
	isUInt32,
	isSInt32,
	isIP,
	isIPV4,
	isEncryptedPassphrase,
	isSemVer,
} from './validation';

export const hex = isHexString;
export const base64 = isBase64String;

export const int64 = (data: string): boolean => isNumberString(data) && isSInt64(BigInt(data));

export const uint64 = (data: string): boolean => isNumberString(data) && isUInt64(BigInt(data));

export const uint32 = (data: string): boolean => isNumberString(data) && isUInt32(BigInt(data));

export const int32 = (data: string): boolean => isNumberString(data) && isSInt32(BigInt(data));

const camelCaseRegex = /^[a-z]+((\d)|([A-Z0-9][a-zA-Z0-9]+))*([a-z0-9A-Z])?$/;

export const camelCase = (data: string): boolean => camelCaseRegex.exec(data) !== null;

export const version = isSemVer;

export const networkVersion = (data: string): boolean =>
	/^(\d|[1-9]\d{1,2})\.(\d|[1-9]\d{1,2})$/.test(data);

export const path = (data: string): boolean => /^(.?)(\/[^/]+)+(\/?)$/.test(data);

export const encryptedPassphrase = isEncryptedPassphrase;

export const ip = isIP;

export const ipOrFQDN = (data: string): boolean => {
	const hostnameRegex = /^[a-zA-Z](([-0-9a-zA-Z]+)?[0-9a-zA-Z])?(\.[a-zA-Z](([-0-9a-zA-Z]+)?[0-9a-zA-Z])?)*$/;
	return isIPV4(data) || hostnameRegex.test(data);
};

export const oddInteger = (data: string | number): boolean => {
	if (typeof data === 'number') {
		return Number.isInteger(data) && data % 2 === 1;
	}
	return /^\d*[13579]$/.test(data);
};
