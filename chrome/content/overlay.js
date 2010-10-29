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
