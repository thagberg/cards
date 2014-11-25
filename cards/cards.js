Games = new Mongo.Collection("games");
Players = new Mongo.Collection("players");
Destinations = new Mongo.Collection("destinations");
Cards = new Mongo.Collection("cards");
Decks = new Mongo.Collection("decks");


if (Meteor.isClient) {

    var gameId = Session.get("gameId");
    console.log(gameId);


    Template.playerCards.helpers({
        getPlayerCards: function() {
            return Destinations.findOne({_id: Session.get('destId')})['cards'];
        }
    });

    Template.handSize.helpers({
        getHandsize: function() {
            return Destinations.findOne({_id: Session.get('destId')})['cards'].length;
        }
    });

    Template.playerList.helpers({
        getPlayerList: function() {
            return Players.find({gameId: Session.get('gameId')}).fetch();
        }
    });

    Template.gameInfo.helpers({
        currentGame: function() {
            return Session.get('gameId');
        },

        playerId: function() {
            return Session.get('playerId');
        },

        handId: function() {
            return Session.get('destId');
        }
    });

    Template.createGame.events({
        'click button': function () {
            Meteor.call('startGame', function(error, result) {
                if (error) {
                    console.log(error);
                } else {
                    Session.set('gameId', result);
                    console.log(result);
                }
            });
        }
    });

    Template.joinGame.events({
        'click button': function(event) {
            gameId = document.getElementById('gameId').value;
            Session.set('gameId', gameId);
            console.log("Joining game: ", gameId);

            Meteor.call('addPlayer', gameId, function(error, result) {
                console.log("Joined game as player: ", result['_id'], result['destId']);
                Session.set('playerId', result['_id']);
                Session.set('destId', result['destId']);
            });
        }
    });

    Template.getCards.events({
        'click button': function(event) {
            var playerId = Session.get('playerId');
            var destId = Session.get('destId');

            Meteor.call('dealCards', gameId, destId, 8, function(error, result) {
                if (error) {
                    console.log("Failed to get cards: ", error);
                } else {
                    var cards = Session.get('cards');
                    if (cards) {
                        Session.set('cards', cards.concat(result));
                    } else {
                        Session.set('cards', result);
                    }
                    console.log("Cards: ", result);
                }
            });
        }
    });

    Template.passCard.events({
        'click button': function(event) {
            var cardSelector = document.getElementById('hand');
            var selectedCards = cardSelector.selectedOptions;
            var playerSelector = document.getElementById('players');
            var selectedPlayer = playerSelector.selectedOptions[0];
            var cards = [];

            for (var i = 0; i < selectedCards.length; i++) {
                var card = selectedCards[i];
                cards.push(card.value);
            }

            var destId = undefined;
            Meteor.call('getPlayerHand', Session.get('gameId'), selectedPlayer.value, function(error, result) {
                if (error) {
                    console.log("Failed to get player hand: ", error);
                } else {
                    console.log(result);
                    destId = result;

                    Meteor.call('passCards', Session.get('gameId'), Session.get('destId'), destId, cards, function(error, result) {
                        if (error) {
                            console.log("Failed to pass cards: ", error);
                        }
                    });
                }
            });

        }
    });
}

if (Meteor.isServer) {

    var games = Games.find({}).fetch();

    Meteor.startup(function () {

    });

    Meteor.methods({
        startGame: function() {
            var gameId = Games.insert({deck: undefined, cards: undefined});
            var destId = Destinations.insert({'gameId': gameId});
            Games.update({_id: gameId}, {$set: {deck: destId}});

            // generate cards
            var cards = [];
            for (var j = 1; j <= 4; j++) {
                var suite = '';
                if (j == 1) {
                    suite = 'Spades';
                } else if (j == 2) {
                    suite = 'Clubs';
                } else if (j == 3) {
                    suite = 'Hearts';
                } else {
                    suite = 'Diamonds';
                }
                for (var i = 1; i <= 13; i++) {
                    var card = {
                        id: "" + j + ":" + i,
                        text: suite + ": " + i
                    };
                    cards.push(card);
                }
            }
            Games.update({_id: gameId}, {$set: {cards: cards}});

            shuffled = [];
            Meteor.call('shuffleCards', cards, function(error, result) {
                if (error) {
                    console.log("Failed to shuffle cards: ", error);
                } else {
                    shuffled = result;
                }
            });
            Destinations.update({_id: destId, gameId: gameId}, {$set: {cards: shuffled}});


            console.log(gameId);
            return gameId;
        },

        addCard: function(gameId, card) {
            var game = Games.findOne({_id: gameId});
            var destId = game['deck'];
            Destinations.update({_id: destId, gameId: gameId}, {$push: {cards: card}});
        },

        addPlayer: function(gameId) {
            var game = Games.findOne({_id: gameId});
            var destId = Destinations.insert({gameId: game['_id'], cards: []});
            var playerId = Players.insert({gameId: game['_id'], destId: destId});

            var player = Players.findOne({_id: playerId, gameId: gameId});

            return player;
        },

        dealCards: function(gameId, destId, numCards) {
            var game = Games.findOne({"_id": gameId});
            var gameDeck = Destinations.findOne({_id: game['deck'], gameId: gameId});
            var deck = gameDeck['cards'];
            var dest = Destinations.findOne({_id: destId, gameId: gameId});
            var retCards = [];
            if (numCards > deck.length) {
                numCards = deck.length;
            }

            for (var i = 0; i < numCards; i++) {
                var card = deck.pop();
                retCards.push(card);
                Destinations.update({_id: destId}, {$push: {cards: card}});
                Destinations.update({_id: gameDeck['_id'], gameId: gameId}, {$pop: {cards: 1}});
            }

            return retCards;
        },

        /*passCards: function(gameId, sourceId, destId, cards) {

            Destinations.update({'_id:': sourceId, gameId: gameId}, {$pullAll: {id: cards}});
            Destinations.update({'_id:': destId, gameId: gameId}, {$pullAll: {id: cards}});
        },*/

        getPlayerHand: function(gameId, playerId) {
            return Players.findOne({_id: playerId, gameId: gameId})['destId'];
        },

        shuffleCards: function(cards) {
            for (var i = 0; i < cards.length; i++) {
                var rand = Math.floor(Math.random() * (cards.length-i) + i);
                var temp = cards[i];
                cards[i] = cards[rand];
                cards[rand] = temp;
            }

            return cards;
        },

        passCards: function(gameId, sourceId, destId, cards) {
            var game = Games.findOne({_id: gameId});
            var source = Destinations.findOne({_id: sourceId, gameId: gameId});
            var dest = Destinations.findOne({_id: destId, gameId: gameId});

            for (var i = 0; i < cards.length; i++) {
                var cardId = cards[i];
                for (var j = 0; j < source['cards'].length; j++) {
                    var card = source['cards'][j];
                    if (card.id == cardId) {
                        dest['cards'].push(card);
                        source['cards'].splice(j, 1);
                        break;
                    }
                }
            }

            Destinations.update({_id: sourceId, gameId: gameId}, {$set: {cards: source['cards']}});
            Destinations.update({_id: destId, gameId: gameId}, {$set: {cards: dest['cards']}});

            return source['cards'];
        }
    });
}
