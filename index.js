'use strict';

const https = require('https');
const moment = require('moment');
const StringDecoder = require('string_decoder').StringDecoder;
const commitSummaryRegex = /^(!|\/)commits\ssummary\s(\d{1})$/;
const pluginSettings = require('./settings.json');

/**
 * Commands:
 *
 * !commits - list 3 latest commits
 * !commits summary {weeks} - Draw basic graph of commits over last X weeks
 */

/**
 * Grab the commits for the repo from GitHub
 * @param  {Function} callback
 * @return {void}
 */
function getCommitsFromGithub( parameters, callback ) {
	// Hit the github URL and get the commits data
	let opts = {
		hostname: 'api.github.com',
		port: 443,
		path: '/repos/' + pluginSettings.githubRepo + '/commits?' + parameters || '',
		method: 'GET',
		headers: {
			'User-Agent': 'ohseemedia-LCTV-Bot'
		}
	};
	let req = https.request( opts, function( res ) {
		let decoder = new StringDecoder('utf-8');
		let data = '';

		res.on('data', function( chunk ) {
			data += decoder.write(chunk);
		});
		res.on('end', function() {
			let json = JSON.parse( data );
			callback( json );
		});
	} );
	req.end();
}

module.exports = [{
	name: '!commits',
	help: 'List 3 latest commits for the bot\'s repository.',
	types: ['message'],
	regex: /^(!|\/)commits$/,
	action: function( chat, stanza ) {
		let commitMessages = [];

		getCommitsFromGithub( '', function( json ) {
			for ( let i = 0; i < 3; i++ ) {
				let commit = json[ i ];
				let commitDate = moment( commit.commit.author.date, 'YYYY-MM-DDThh:mm:ssZ' ).format('YYYY-MM-DD');
				let msg = (i + 1) + '. ' + commitDate + ' - ' + commit.commit.message;
				commitMessages.push( msg );
			}

			if ( commitMessages.length === 0 ) {
				chat.sendMessage('No commits!');
				return;
			}

			chat.sendMessage( 'Last 3 commits:\n' + commitMessages.join('\n') );
		} );
	}
}, {
	name: '!commits summary {X}',
	help: 'Draw graph of commits over last X weeks.',
	types: ['message'],
	regex: commitSummaryRegex,
	action: function( chat, stanza ) {
		let numberOfWeeks = Math.min( 5, parseInt( commitSummaryRegex.exec( stanza.message )[2], 10 ) );
		let numberOfDays = numberOfWeeks * 7;
		let date = moment().subtract(numberOfWeeks, 'weeks');
		let since = date.format('YYYY-MM-DDTHH:MM:SSZ');
		let parameters = 'since=' + since;

		// Gather our days that we will display
		let weeks = [];
		let days = {};
		let today = moment();
		for ( let i = 0; i < numberOfWeeks; i++ ) {
			let week = {
				id: i + 1,
				startDate: '',
				endDate: '',
				days: []
			};
			for ( let d = 0; d < 7; d++ ) {
				if ( d === 0 ) {
					week.startDate = today.format('MM/DD');
				}
				if ( d === 6 ) {
					week.endDate = today.format('MM/DD');
				}

				let date = today.format('YYYY-MM-DD');
				week.days[ date ] = 0;
				days[date] = 0;

				today.subtract(1, 'day');
			}

			weeks.push(week);
		}

		getCommitsFromGithub( parameters, function( commits ) {
			// Assign each commit to a date
			for ( let commit of commits ) {
				let commitDate = moment( commit.commit.author.date, 'YYYY-MM-DDThh:mm:ssZ' ).format('YYYY-MM-DD');
				days[commitDate]++;
			}

			// Loop the weeks
			// Output the start/end date for each each
			// Output the commit count for each day in the week
			let msg = '';
			for ( let week of weeks ) {
				msg += week.startDate + ' - ' + week.endDate + ': ';
				for ( let date in week.days ) {
					let commitCount = days[date];
					msg += commitCount === 0 ? ' _ ' : ' ' + commitCount + ' ';
				}
				msg += '\n';
			}

			let weeksText = numberOfWeeks === 1 ? 'week' : 'weeks';
			chat.sendMessage( 'Commits for the last ' + numberOfWeeks + ' ' + weeksText + ':\n' + msg );
		} );
	}
}];
