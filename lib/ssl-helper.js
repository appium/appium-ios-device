import tls from 'tls';


const TLS_VERSION = 'TLSv1_method';

function upgradeToSSL (socket, key, cert) {
  return new tls.TLSSocket(socket, {
    rejectUnauthorized: false,
    secureContext: tls.createSecureContext({
      key,
      cert,
      secureProtocol: TLS_VERSION
    })
  });
}
export { upgradeToSSL };
