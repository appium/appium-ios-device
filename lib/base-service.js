class BaseServiceSocket {
  constructor (socketClient) {
    this._socketClient = socketClient;
    this._socketClient.once('close', () => {
      this._socketClient.destroy();
    });
  }

  /**
   * Closes the underlying socket communicating with the phone
   */
  close () {
    if (this._socketClient.destroyed) {
      return;
    }

    this._socketClient.end();
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
