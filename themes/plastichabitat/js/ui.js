
/**
 * toggleClass
 * Handles class toggling, you didn't see that one coming or did you?
 */

var navigationModal = function(targets, toggleClass, action) {

    'use strict';

    /**
     * Get targets
     */

    var items = document.querySelectorAll(targets);

    /**
     * Set event listeners
     */

    [].forEach.call(items, function (item) {
        item.addEventListener(action, toggleItem);
    });

    /**
     * Toggle classes
     */

    function toggleItem(e) {

        // Class list is supported, a modern browser!
        if (this.classList) {
            this.classList.toggle(toggleClass);

        // Go the old fashion way...
        } else {
            var classes = el.className.split(' ');
            var existingIndex = classes.indexOf(toggleClass);

            if (existingIndex >= 0)
                classes.splice(existingIndex, 1);
            else
                classes.push(toggleClass);

            el.className = classes.join(' ');
        }
    }
};

/**
 * UI
 * All user interface related code.
 */

(function (window, document) {

    'use strict';

    var navigation = new navigationModal('.navigation', '-open', 'click');

}(this, this.document));
