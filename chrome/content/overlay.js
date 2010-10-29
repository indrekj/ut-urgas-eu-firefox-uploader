var uturgas = {
  theDot: null,

  onFirefoxLoad: function(event) {
    this.initialized = true;
    this.theDot = document.getElementById("uturgas-statusbar-dot");

    this.strings = document.getElementById("uturgas-strings");
    // usage: this.strings.getString("helloMessageTitle")*/

    var appcontent = document.getElementById("appcontent"); // browser  
    if (appcontent)
      appcontent.addEventListener("DOMContentLoaded", function(e) { uturgas.onPageLoad(e); }, true);
  },

  onPageLoad: function(event) {
    var doc = event.originalTarget; // doc is document that triggered "onload" event

    if (doc.location.href.search("google") > -1) {
      uturgas.theDot.style.color = "green";
    }

    // add event listener for page unload
    event.originalTarget.defaultView.addEventListener("unload", function() { 
      uturgas.onPageUnload(); 
    }, true);
  },

  onPageUnload: function(event) {
    uturgas.theDot.style.color = "black";
  }
};

window.addEventListener("load", function() {
  uturgas.onFirefoxLoad()
}, false);
