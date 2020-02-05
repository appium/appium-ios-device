class BaseServiceSocket {
  constructor (socketClient) {
    this._socketClient = socketClient;
  }

  _assignClientFailureHandlers (...sourceStreams) {
    for (const evt in ['close', 'end']) {
      this._socketClient.once(evt,
        () => sourceStreams.map((s) => s.unpipe(this._socketClient)));
    }
  }

  /**
   * Closes the underlying socket communicating with the phone
   */
  close () {
    if (!this._socketClient.destroyed) {
      this._socketClient.end();
    }
  }
}

class BaseServicePlist {
  constructor (plistService) {
    this._plistService = plistService;
  }

  /**
   * Closes the underlying socket communicating with the phone
   */
  close () {
    this._plistService.close();
  }
}


export { BaseServiceSocket, BaseServicePlist };
