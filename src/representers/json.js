
module.exports = function() {

    return {
        errorMessage: function(message) {
            return '{\n\t"error": "' + message + '"\n}';
        }
    };
}
