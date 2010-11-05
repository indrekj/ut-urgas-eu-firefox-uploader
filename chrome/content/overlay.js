var uturgasUrlBarListener = {
  QueryInterface: function(aIID) {
    if (aIID.equals(Ci.nsIWebProgressListener) ||
        aIID.equals(Ci.nsISupportsWeakReference) ||
        aIID.equals(Ci.nsISupports))
      return this;
    throw Components.results.NS_NOINTERFACE;
  },

  onLocationChange: function(aProgress, aRequest, aURI) {
    uturgas.onPageChange(aURI);
  },

  onStateChange: function(a, b, c, d) {},
  onProgressChange: function(a, b, c, d, e, f) {},
  onStatusChange: function(a, b, c, d) {},
  onSecurityChange: function(a, b, c) {}
};

var uturgasPrefs = {
  prefs: Cc["@mozilla.org/preferences-service;1"].
      getService(Ci.nsIPrefService).
      getBranch("extensions.uturgas."),

  getHost: function() {
    var host = this.prefs.getCharPref("host");
    if (!host)
      host = "http://ut.urgas.eu";
    return host;
  }
};

var uturgasUploader = {
  uploadURL: uturgasPrefs.getHost() + "/assessments",
  existsURL: uturgasPrefs.getHost() + "/assessments/exists",

  upload: function(file, attemptId) {
    var postRequest = createPostRequest({
      "assessment[attempt_id]": attemptId,
      "file": {
        "file": file
      }
    });

    // post it
    var req = new XMLHttpRequest();
    req.open("POST", this.uploadURL);
    req.setRequestHeader("Content-Type", "multipart/form-data; boundary=" + postRequest.boundary);
    req.setRequestHeader("Content-Length", postRequest.requestBody.available());
    req.onreadystatechange = function() {
      if (req.readyState == 4 && req.status == 200) {
        var res = eval('(' + req.responseText + ')');
        var features = "chrome,titlebar,toolbar,centerscreen,modal";
        window.openDialog(
          "chrome://uturgas/content/confirmation.xul", 
          "Töö atribuudid", 
          features,
          res.assessment.id,
          res.assessment.title,
          res.assessment.category_name
        );      
      }
    };
    req.send(postRequest.requestBody);
  },

  sendConfirmation: function() {
    var id = window.arguments[0];
    var params = 
      "assessment[title]=" + document.getElementById("assessment_title").value + 
      "&assessment[category_name]=" + document.getElementById("assessment_category").value + 
      "&assessment[author]=" + document.getElementById("assessment_author").value;

    var req = new XMLHttpRequest();
    req.open("PUT", this.uploadURL + "/" + id);
    req.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
    req.setRequestHeader("Content-Length", params.length);
    req.onreadystatechange = function() {
      if (req.readyState == 4 && req.status == 200) {
        var res = eval('(' + req.responseText + ')');
        uturgas.theDot.src = "chrome://uturgas/skin/green.png";
        uturgas.menuAdd.disabled = false;
      }
    };
    req.send(params);

    return true;
  }
}

var uturgas = {
  theDot: null,
  menuAdd: null,
  currentPage: null,
  currentUri: null,
  attemptId: null,

  onFirefoxLoad: function(event) {
    this.initialized = true;
    this.theDot = document.getElementById("uturgas-statusbar-dot");
    this.menuAdd = document.getElementById("uturgas-menu-upload");

    this.strings = document.getElementById("uturgas-strings");
    // usage: this.strings.getString("helloMessageTitle")

    gBrowser.addProgressListener(
      uturgasUrlBarListener, 
      Ci.nsIWebProgress.NOTIFY_LOCATION
    );
  },

  onPageChange: function(aURI) {
    // reset variables
    this.currentPage = null;
    this.attemptId = null;
    this.theDot.src = "chrome://uturgas/skin/black.png";
    this.menuAdd.disabled = true;
    this.currentUri = aURI;

    var href = aURI.spec;

    var res = href.match(/moodle\.ut\.ee.*review\.php\?attempt=(\d+)&showall=true/);
    if (res) {
      this.currentPage = "moodle";
      this.attemptId = res[1];
      this.checkAttempt();
      return;
    }

    res = href.match(/webct\.e\-uni\.ee.*attempt=(\d+)/);
    if (res) {
      this.currentPage = "webct";
      this.attemptId = res[1];
      this.checkAttempt();
      return;
    }

    res = href.match(/webct\.e\-uni\.ee/);
    if (res) {
      // TODO: check iframe ?
    } 
  },

  checkAttempt: function() {
    if (this.currentPage) {
      var self = this;
      var req = new XMLHttpRequest();
      var params = "?source=" + this.currentPage + "&attempt_id=" + this.attemptId;
      req.open("GET", uturgasUploader.existsURL + params, true);
      req.onreadystatechange = function() {
        if (req.readyState == 4 && req.status == 200) {
          var res = eval('(' + req.responseText + ')');
          if (res.exists)
            self.theDot.src = "chrome://uturgas/skin/green.png";
          else {
            self.theDot.src = "chrome://uturgas/skin/yellow.png";
            self.menuAdd.disabled = false;
            self.showNotification();
          } 
        }
      };
      req.send(null);
    }
  },

  showNotification: function() {
    var nb = gBrowser.getNotificationBox();
    if (nb.currentNotification != null)
      return;
    
    var message = "Soovid lisada selle töö urka kataloogi?";  
    var buttons = [{  
      label: 'Lisa...',  
      accessKey: 'L',  
      callback: function() {
        uturgas.startUpload();
      }  
    }];  
    
    const priority = nb.PRIORITY_WARNING_MEDIUM;  
    nb.appendNotification(
      message, "new-uturgas-assessment",
      "chrome://uturgas/skin/black.png", priority, buttons
    );    
  },

  startUpload: function() {
    var file = Cc["@mozilla.org/file/directory_service;1"].  
      getService(Ci.nsIProperties).  
      get("TmpD", Ci.nsIFile);  

    file.append("ut-urgas-eu-" + this.currentPage + "-" + this.attemptId + ".html");
    file.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, 0666);  
    
    var self = this;
    var wbp = Cc['@mozilla.org/embedding/browser/nsWebBrowserPersist;1'].
      createInstance(Ci.nsIWebBrowserPersist);
    wbp.persistFlags &= ~Ci.nsIWebBrowserPersist.PERSIST_FLAGS_NO_CONVERSION;
    wbp.progressListener = {
      onProgressChange: function(aWebProgress, aRequest, aCurSelfProgress, 
          aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress, aDownload) {
      },
      onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus, aDownload) {
        if (aStateFlags & Ci.nsIWebProgressListener.STATE_STOP)
          uturgasUploader.upload(file, self.attemptId);
      }
    };
    wbp.saveURI(this.currentUri, null, null, null, null, file); 
  },

  openHelpDialog: function() {
    var features = "chrome,titlebar,toolbar,centerscreen,modal";
    window.openDialog("chrome://uturgas/content/help.xul", "Kasutusjuhend", features);
  }
};

// http://www.chrisfinke.com/2010/01/30/
function createPostRequest(args) {
  /**
   * Generates a POST request body for uploading.
   *
   * args is an associative array of the form fields.
   *
   * Example:
   * var args = { "field1": "abc", "field2" : "def", "fileField" :
   *              { "file": theFile, "headers" : [ "X-Fake-Header: foo" ] } };
   *
   * theFile is an nsILocalFile; the headers param for the file field is optional.
   *
   * This function returns an array like this:
   * { "requestBody" : uploadStream, "boundary" : BOUNDARY }
   *
   * To upload:
   *
   * var postRequest = createPostRequest(args);
   * var req = new XMLHttpRequest();
   * req.open("POST", ...);
   * req.setRequestHeader("Content-Type","multipart/form-data; boundary="+postRequest.boundary);
   * req.setRequestHeader("Content-Length", (postRequest.requestBody.available()));
   * req.send(postRequest.requestBody);
   */

  function fileToStream(file) {
    var fpLocal = Cc['@mozilla.org/file/local;1'].
      createInstance(Ci.nsILocalFile);
    fpLocal.initWithFile(file);
    var finStream = Cc["@mozilla.org/network/file-input-stream;1"].
      createInstance(Ci.nsIFileInputStream);
    finStream.init(fpLocal, 1, 0, false);
    var bufStream = Cc["@mozilla.org/network/buffered-input-stream;1"].
      createInstance(Ci.nsIBufferedInputStream);
    bufStream.init(finStream, 9000000);
    return bufStream;
  }

  function stringToStream(str) {
    function encodeToUtf8(oStr) {
      var utfStr = oStr;
      var uConv = Cc["@mozilla.org/intl/scriptableunicodeconverter"].
        createInstance(Ci.nsIScriptableUnicodeConverter);
      uConv.charset = "UTF-8";
      utfStr = uConv.ConvertFromUnicode(oStr);

      return utfStr;
    }
    
    str = encodeToUtf8(str);
    var stream = Cc["@mozilla.org/io/string-input-stream;1"].
      createInstance(Ci.nsIStringInputStream);
    stream.setData(str, str.length);
    return stream;
  }

  var mimeSvc = Cc["@mozilla.org/mime;1"].
    getService(Components.interfaces.nsIMIMEService);
  const BOUNDARY = "----------------" + Math.random(); 

  var streams = [];

  for (var i in args) {
    var buffer = "--" + BOUNDARY + "\r\n";
    buffer += "Content-Disposition: form-data; name=\"" + i + "\"";
    streams.push(stringToStream(buffer));

    if (args[i] == null) {
      buffer = "\r\n\r\n\r\n";
      streams.push(stringToStream(buffer));
    } else if (typeof args[i] == "object") {
      buffer = "; filename=\"" + args[i].file.leafName + "\"";

      if ("headers" in args[i]) {
        if (args[i].headers.length > 0) {
          for (var q = 0; q < args[i].headers.length; q++){
            buffer += "\r\n" + args[i].headers[q];
          }
        }
      }

      var theMimeType = mimeSvc.getTypeFromFile(args[i].file);

      buffer += "\r\nContent-Type: " + theMimeType;
      buffer += "\r\n\r\n";

      streams.push(stringToStream(buffer));

      streams.push(fileToStream(args[i].file));
    } else {
      buffer = "\r\n\r\n";
      buffer += args[i];
      buffer += "\r\n";
      streams.push(stringToStream(buffer));
    }
  }

  var buffer = "--" + BOUNDARY + "--\r\n";
  streams.push(stringToStream(buffer));

  var uploadStream = Cc["@mozilla.org/io/multiplex-input-stream;1"].
    createInstance(Ci.nsIMultiplexInputStream);

  for (var i = 0; i < streams.length; i++) {
    uploadStream.appendStream(streams[i]);
  }

  return {"requestBody" : uploadStream, "boundary": BOUNDARY};
}

window.addEventListener("load", function() {
  uturgas.onFirefoxLoad()
}, false);
