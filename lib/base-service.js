class BaseServiceSocket {
  constructor (socketClient) {
    this._socketClient = socketClient;
  }

  /**
   * Closes the underlying socket communicating with the phone
   */
  close () {
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
