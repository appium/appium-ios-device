import tls from 'tls';

const TLS_VERSION = 'TLSv1_method';

function upgradeToSSL (socket, key, cert) {
  return new tls.TLSSocket(socket, {
    secureContext: tls.createSecureContext({
      key,
      cert,
      rejectUnauthorized: false,
      secureProtocol: TLS_VERSION
    })
  });
}
export { upgradeToSSL };

