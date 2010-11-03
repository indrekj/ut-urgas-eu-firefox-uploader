var uturgasUrlBarListener = {
  QueryInterface: function(aIID) {
    if (aIID.equals(Components.interfaces.nsIWebProgressListener) ||
        aIID.equals(Components.interfaces.nsISupportsWeakReference) ||
        aIID.equals(Components.interfaces.nsISupports))
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

var uturgasUploader = {
  uploadURL: "http://localhost:3000/assessments",
  existsURL: "http://localhost:3000/assessments/exists",

  upload: function(file, attemptId) {
    // generate boundary string
    var boundaryString = "ut-urgas-eu-boundary-" + Math.random();
    var boundary = "--" + boundaryString;
    var filename = "TODO.html";

    // create a string input stream with the form preamble
    var formData = boundary + '\r\n' +
      'Content-Disposition: form-data; name="file"; filename="' + filename + '"' + '\r\n' +
      'Content-Type: text/html' + '\r\n\r\n';
    var prefixStringInputStream = this.stringToStream(formData);

    // convert content to input stream
    var contentStringInputStream = this.fileToStream(file);

    // write out the rest of the form to another string input stream
    var suffixStringInputStream = this.stringToStream("\r\n" + boundary + "\r\n");

    // multiplex the streams together
    var uploadStream = Components.
      classes["@mozilla.org/io/multiplex-input-stream;1"].
      createInstance(Components.interfaces.nsIMultiplexInputStream);
    uploadStream.appendStream(prefixStringInputStream);
    uploadStream.appendStream(contentStringInputStream);
    uploadStream.appendStream(suffixStringInputStream);

    // post it
    var req = new XMLHttpRequest();
    req.open("POST", this.uploadURL);
    req.setRequestHeader("Content-Type", "multipart/form-data; boundary=" + boundaryString);
    req.setRequestHeader("Content-Length", uploadStream.available());
    req.send(uploadStream);
  },
  
  // from: http://www.chrisfinke.com/2010/01/30/
  fileToStream: function(file) {
    if (typeof file == "string") {
      var fpLocal = Components.
        classes['@mozilla.org/file/local;1'].
        createInstance(Components.interfaces.nsILocalFile);
      fpLocal.initWithFile(file);
    } else {
      var fpLocal = file;
    }

    var finStream = Components.
      classes["@mozilla.org/network/file-input-stream;1"].
      createInstance(Components.interfaces.nsIFileInputStream);
    finStream.init(fpLocal, 1, 0, false);
    var bufStream = Components.
      classes["@mozilla.org/network/buffered-input-stream;1"].
      createInstance(Components.interfaces.nsIBufferedInputStream);
    bufStream.init(finStream, 9000000);
    return bufStream;
  },

  // from: http://www.chrisfinke.com/2010/01/30/
  stringToStream: function(str) {
    function encodeToUtf8(oStr) {
      var utfStr = oStr;
      var uConv = Components.
        classes["@mozilla.org/intl/scriptableunicodeconverter"].
        createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
      uConv.charset = "UTF-8";
      utfStr = uConv.ConvertFromUnicode(oStr);

      return utfStr;
    }
    
    str = encodeToUtf8(str);
    var stream = Components.
      classes["@mozilla.org/io/string-input-stream;1"].
      createInstance(Components.interfaces.nsIStringInputStream);
    stream.setData(str, str.length);
    return stream;
  }
}

var uturgas = {
  theDot: null,
  currentPage: null,
  currentUri: null,
  attemptId: null,

  onFirefoxLoad: function(event) {
    this.initialized = true;
    this.theDot = document.getElementById("uturgas-statusbar-dot");

    this.strings = document.getElementById("uturgas-strings");
    // usage: this.strings.getString("helloMessageTitle")

    gBrowser.addProgressListener(
      uturgasUrlBarListener, 
      Components.interfaces.nsIWebProgress.NOTIFY_LOCATION
    );
  },

  onPageChange: function(aURI) {
    // reset variables
    this.currentPage = null;
    this.attemptId = null;
    this.theDot.src = "chrome://uturgas/skin/black.png";

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
    
    res = href.match(/google/);
    if (res) {
      this.currentPage = "google"; // this is temporary just for testing
      this.checkAttempt();
      return;
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
          else
            self.theDot.src = "chrome://uturgas/skin/yellow.png";
        }
      };
      req.send(null);
    }
  },

  startUpload: function() {
    var Cc = Components.classes;
    var Ci = Components.interfaces;
    var file = Cc["@mozilla.org/file/local;1"].
      createInstance(Ci.nsILocalFile);  
    file.initWithPath("/tmp/ut-urgas-eu-test.html");  
    var wbp = Cc['@mozilla.org/embedding/browser/nsWebBrowserPersist;1'].
      createInstance(Ci.nsIWebBrowserPersist);

    // don't save gzipped
    wbp.persistFlags &= ~Ci.nsIWebBrowserPersist.PERSIST_FLAGS_NO_CONVERSION;  
    wbp.saveURI(this.currentUri, null, null, null, null, file); 

    uturgasUploader.upload(file, this.attemptId);
  }
};

window.addEventListener("load", function() {
  uturgas.onFirefoxLoad()
}, false);
