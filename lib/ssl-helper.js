import tls from 'node:tls';
import net from 'node:net';

const HANDSHAKE_TIMEOUT_MS = 10000;

/**
 * Wraps an existing socket in a TLS socket.
 * @param {import('net').Socket} socket
 * @param {Buffer|string} key
 * @param {Buffer|string} cert
 * @returns {import('node:tls').TLSSocket}
 */
export function upgradeToSSL(socket, key, cert) {
  return new tls.TLSSocket(socket, {
    rejectUnauthorized: false,
    secureContext: tls.createSecureContext({
      key,
      cert,
    }),
  });
}

/**
 * After the ssl protocol is successfully handshake, close the ssl protocol channel and use text transmission
 * @param socket
 * @param key
 * @param cert
 * @returns {Promise<NodeJS.Socket>} Duplicate the input socket
 */
export async function enableSSLHandshakeOnly(socket, key, cert) {
  const sslSocket = tls.connect({
    socket,
    secureContext: tls.createSecureContext({
      key,
      cert,
    }),
    rejectUnauthorized: false,
  });

  // stop receiving data after successful handshake
  await new Promise((resolve, reject) => {
    let isSettled = false;

    const cleanup = () => {
      clearTimeout(timeoutHandler);
      sslSocket.off('secureConnect', onSecureConnect);
      sslSocket.off('error', onError);
    };

    const onError = (err) => {
      if (isSettled) {
        return;
      }
      isSettled = true;
      cleanup();
      reject(err);
    };

    const onSecureConnect = () => {
      if (isSettled) {
        return;
      }
      isSettled = true;
      cleanup();
      // @ts-ignore This is a hack
      sslSocket._handle.readStop();
      resolve(undefined);
    };

    const timeoutHandler = setTimeout(() => {
      if (isSettled) {
        return;
      }
      isSettled = true;
      cleanup();
      if (!sslSocket.destroyed) {
        sslSocket.end();
      }
      reject(new Error('ssl handshake error'));
    }, HANDSHAKE_TIMEOUT_MS);

    sslSocket.once('secureConnect', onSecureConnect);
    sslSocket.once('error', onError);
  });
  // Duplicate the socket. Return a new socket object connected to the same system resource
  return new net.Socket({fd: socket._handle.fd});
}
