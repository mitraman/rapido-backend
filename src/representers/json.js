"use strict";

module.exports = function() {

    return {
        errorMessage: function(message) {
            return '{\n\t"error": "' + message + '"\n}';
        },
        responseMessage: function(message) {
            return message;
        }
    };
}
