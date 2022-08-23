import { LastCertificate, LastCertificateJSON } from './types';

export const certificateToJSON = (certificate: LastCertificate): LastCertificateJSON => ({
	height: certificate.height,
	timestamp: certificate.timestamp,
	stateRoot: certificate.stateRoot.toString('hex'),
	validatorsHash: certificate.validatorsHash.toString('hex'),
});
