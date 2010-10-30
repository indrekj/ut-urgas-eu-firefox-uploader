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

  upload: function(content, attemptId) {
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
    var contentStringInputStream = this.stringToStream(content);

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
    var href = aURI.spec;
    if (href.match(/moodle\.ut\.ee.*review\.php\?q=(\d+)&attempt=(\d+)/)) {
      this.currentPage = "moodle";
    } else if (href.match(/webct\.e\-uni\.ee.*attempt=(\d+)/)) {
      this.currentPage = "webct";
    } else if (href.match(/webct\.e\-uni\.ee/)) {
      // TODO: check iframe
      this.currentPage = null;
    } else if (href.match(/google/)) {
      this.currentPage = "google"; // this is temporary just for testing
    } else {
      this.currentPage = null;
    }

    if (this.currentPage) {
      this.theDot.style.color = "yellow";
    } else {
      this.theDot.style.color = "black";
    }
  }
};

window.addEventListener("load", function() {
  uturgas.onFirefoxLoad()
}, false);
