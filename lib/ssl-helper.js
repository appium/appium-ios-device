import tls from 'tls';
import net from 'net';
import B from 'bluebird';

const TLS_VERSION = 'TLSv1_method';
const HANDSHAKE_TIMEOUT_MS = 10000;

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

/**
 * After the ssl protocol is successfully handshake, close the ssl protocol channel and use text transmission
 * @param socket
 * @param key
 * @param cert
 * @returns {Promise<Socket>} Duplicate the input socket
 */
async function enableSSLHandshakeOnly (socket, key, cert) {
  const sslSocket = tls.connect({
    socket,
    secureContext: tls.createSecureContext({
      key,
      cert,
      secureProtocol: TLS_VERSION
    }),
    rejectUnauthorized: false,
  });

  // stop receiving data after successful handshake
  await new B((resolve, reject) => {
    const timeoutHandler = setTimeout(() => {
      if (!sslSocket.destroyed) {
        sslSocket.end();
      }
      return reject(new Error('ssl handshake error'));
    }, HANDSHAKE_TIMEOUT_MS);

    sslSocket.once('secureConnect', () => {
      clearTimeout(timeoutHandler);
      sslSocket._handle.readStop();
      return resolve();
    });
  });
  // Duplicate the socket. Return a new socket object connected to the same system resource
  return net.Socket({fd: socket._handle.fd});
}


export { upgradeToSSL, enableSSLHandshakeOnly };
