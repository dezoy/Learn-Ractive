/*global window, define, CodeMirror, document, prettyPrint */

define( [ 'Ractive', 'views/Main' ], function ( RealRactive, Main ) {
	
	'use strict';

	var eval2, teardown, teardownQueue, onResizeHandlers, prop, timeouts, _setTimeout, _clearTimeout, report, reportQueue, Ractive;

	eval2 = eval; // changes to global context. Bet you didn't know that! Thanks, http://stackoverflow.com/questions/8694300/how-eval-in-javascript-changes-the-calling-context

	teardownQueue = [];
	timeouts = [];

	_setTimeout = window.setTimeout;
	_clearTimeout = window.clearTimeout;

	window.setTimeout = function ( fn, delay ) {
		var timeout = _setTimeout.apply( window, arguments );
		timeouts[ timeouts.length ] = timeout;
	};

	window.clearTimeout = function ( timeout ) {
		var index = timeouts.indexOf( timeout );
		if ( index !== -1 ) {
			timeouts.splice( index, 1 );
		}

		_clearTimeout( timeout );
	};

	teardown = function () {
		while ( teardownQueue.length ) {
			teardownQueue.pop().teardown();
		}

		// neuter any onResize handlers
		onResizeHandlers = [];

		// clear any timeouts
		while ( timeouts[0] ) {
			window.clearTimeout( timeouts[0] );
		}
	};


	window.Ractive = Ractive = function () {
		// we need to override the constructor so we can keep track of
		// which views need to be torn down during the tutorial
		RealRactive.apply( this, arguments );
		teardownQueue[ teardownQueue.length ] = this;
	};

	window.Ractive.prototype = RealRactive.prototype;

	/// copy static methods and properties from the real Ractive to the fake one
	for ( prop in RealRactive ) {
		if ( RealRactive.hasOwnProperty( prop ) ) {
			window.Ractive[ prop ] = RealRactive[ prop ];
		}
	}

	onResizeHandlers = [];
	window.onResize = function ( handler ) {
		onResizeHandlers[ onResizeHandlers.length ] = handler;
	};

	reportQueue = [];
	report = function ( category, action, label, value ) {
		reportQueue[ reportQueue.length ] = {
			hitType: 'event',
			eventCategory: category,
			eventAction: action,
			eventLabel: label,
			eventValue: value
		};

		if ( ga ) {
			while ( reportQueue.length ) {
				ga( 'send', reportQueue.shift() );
			}
		}
	};

	return function ( app ) {
		var mainView,
			editors,
			blocks,
			tutorial,
			tutorials,
			tutorialBySlug,
			tutorialIndex,
			currentTutorial,
			stepIndex,
			currentStep,
			executeJs,
			executeConsole,
			slugify,
			hashPattern,
			parseHash,
			reset,
			divvyState;

		slugify = function ( str ) {
			if ( !str ) {
				return '';
			}
			return str.toLowerCase().replace( /[^a-z]/g, '-' ).replace( /-{2,}/g, '-' ).replace( /^-/, '' ).replace( /-$/, '' );
		};

		tutorialBySlug = {};
		window.tutorials = tutorials = app.data.tutorials.map( function ( tutorial, i ) {
			tutorial.slug = slugify( tutorial.title );
			tutorial.index = i;

			tutorialBySlug[ tutorial.slug ] = tutorial;

			return tutorial;
		});


		executeJs = function ( noReport ) {
			var code = editors.javascript.getValue();

			teardown();

			window.template = editors.template.getValue();
			window.output = document.getElementById( 'output' );

			try {
				eval2( code );

				if ( noReport !== true ) {
					report( 'javascript', 'execute', null, app.state.get( 'tutorialStepCode' ) );
				}

			} catch ( err ) {
				
				report( 'javascript', 'error', err.message || err, app.state.get( 'tutorialStepCode' ) );

				console.error( err );

				throw err; // TODO - feedback to user
			}
		};

		executeConsole = function () {
			var code = editors.console.getValue();

			try {
				eval2( code );

				report( 'console', 'execute', null, app.state.get( 'tutorialStepCode' ) );

			} catch ( err ) {
				
				report( 'console', 'error', err.message || err, app.state.get( 'tutorialStepCode' ) );

				throw err; // TODO - feedback to user
			}
		};

		mainView = new Main({
			el: 'container',
			data: {
				numTutorials: tutorials.length
			}
		});

		mainView.divvy.restore();

		mainView.divvy.on( 'resize', function ( changed ) {
			var state;

			this.save();

			if ( !changed[ 'output-block' ] ) {
				return;
			}
			
			var i = onResizeHandlers.length;
			while ( i-- ) {
				onResizeHandlers[i].call();
			}
		});

		blocks = {
			copy: document.getElementById( 'copy' ),
			output: document.getElementById( 'output' ),
			templateEditor: document.getElementById( 'template-editor' ),
			javascriptEditor: document.getElementById( 'javascript-editor' ),
			consoleEditor: document.getElementById( 'console-editor' )
		};

		editors = {};

		editors.template = new CodeMirror( blocks.templateEditor, {
			mode: 'htmlmixed',
			theme: 'ractive',
			lineNumbers: true,
			lineWrapping: true
		});

		editors.javascript = new CodeMirror( blocks.javascriptEditor, {
			mode: 'javascript',
			theme: 'ractive',
			lineNumbers: true,
			lineWrapping: true,
			extraKeys: { 'Shift-Enter': executeJs }
		});

		editors.console = new CodeMirror( blocks.consoleEditor, {
			mode: 'javascript',
			theme: 'ractive',
			lineNumbers: true,
			lineWrapping: true,
			extraKeys: { 'Shift-Enter': executeConsole }
		});


		// find current tutorial, and step (if not tutorial 1, step 1)
		hashPattern = /#!\/([a-z\-]+)\/([0-9]+)/;
		parseHash = function () {
			var match = hashPattern.exec( window.location.hash );
			if ( match ) {
				tutorial = tutorialBySlug[ match[1] ];
				if ( tutorial ) {
					app.state.set({
						tutorialIndex: tutorial.index || 0,
						stepIndex: ( +match[2] - 1 ) || 0
					});
				}
			}
		};
		
		app.state.set( 'tutorials', app.data.tutorials );
		if ( window.location.hash ) {
			parseHash();
		} else {
			app.state.set({
				tutorialIndex: 0,
				stepIndex: 0
			});
		}

		if ( window.addEventListener ) {
			window.addEventListener( 'hashchange', parseHash );
		} else {
			window.onhashchange = parseHash;
		}
		

		app.state.compute({
			currentTutorial: '${tutorials}[ ${tutorialIndex } ]',
			currentStep: '${currentTutorial}.steps[ ${stepIndex} ]',
			nextStepDisabled: '${stepIndex} >= ( ${currentTutorial}.steps.length - 1 )',
			prevStepDisabled: '${stepIndex} === 0',
			nextTutorialDisabled: '${tutorialIndex} >= ( ${tutorials}.length - 1 )',
			prevTutorialDisabled: '${tutorialIndex} === 0',
			tutorialStepCode: '( ( ${tutorialIndex} + 1 ) * 100 ) + ${stepIndex} + 1'
		});

		reset = function ( step, noReport ) {
			if ( !step ) {
				return;
			}

			// teardown any Ractive instances that have been created
			teardown();
			
			editors.template.setValue( step.template || '' );
			editors.javascript.setValue( step.javascript || '' );
			editors.console.setValue( step.console || '' );

			mainView.set({
				copy: step.copy,
				css: step.styles || app.state.get( 'currentTutorial.styles' ),
				fixDisabled: ( step.fixed ? '' : 'disabled' )
			});

			if ( step.init ) {
				executeJs( true );
			}

			prettyPrint();

			// update hash
			window.location.hash = '!/' + app.state.get( 'currentTutorial.slug' ) + '/' + ( app.state.get( 'stepIndex' ) + 1 );

			// scroll all blocks back to top - TODO
			blocks.copy.scrollTop = 0;
			blocks.output.scrollTop = 0;
			editors.template.scrollTo( 0, 0 );
			editors.javascript.scrollTo( 0, 0 );
			editors.console.scrollTo( 0, 0 );

			if ( !noReport ) {
				report( 'tutorial', 'reset', null, app.state.get( 'tutorialStepCode' ) );
			}
		};

		app.state.observe({
			stepIndex: function ( index ) {
				var isFirst, isLast;

				isFirst = ( index === 0 );
				isLast = ( index === this.get( 'currentTutorial.steps.length' ) - 1 );

				mainView.set({
					stepNum: index + 1,
					stepOrTutorial: ( isLast ? 'tutorial' : 'step' )
				});
			},
			nextStepDisabled: function ( disabled ) {
				mainView.set( 'nextDisabled', disabled ? 'disabled' : '' );
			},
			prevStepDisabled: function ( disabled ) {
				mainView.set( 'prevDisabled', disabled ? 'disabled' : '' );
			},
			nextTutorialDisabled: function ( disabled ) {
				mainView.set( 'nextTutorialDisabled', disabled ? 'disabled' : '' );
			},
			prevTutorialDisabled: function ( disabled ) {
				mainView.set( 'prevTutorialDisabled', disabled ? 'disabled' : '' );
			},
			tutorialStepCode: function ( code ) {
				report( 'tutorial', 'enter', null, code );
			},
			currentStep: function ( step ) {
				reset( step, true );
			},
			tutorialIndex: function ( index ) {
				mainView.set( 'tutorialNum', index + 1 );
			},
			currentTutorial: function ( tutorial ) {
				if ( !tutorial ) {
					return;
				}

				mainView.set({
					title: tutorial.title,
					numSteps: tutorial.steps.length
				});
			}
		});



		mainView.on({
			'execute-js': executeJs,
			'execute-console': executeConsole,
			prev: function () {
				var currentStepIndex = app.state.get( 'stepIndex' );

				if ( currentStepIndex > 0 ) {
					app.state.set( 'stepIndex', currentStepIndex - 1 );
				}
			},
			next: function () {
				var currentStepIndex, numSteps, currentTutorialIndex, numTutorials;

				currentStepIndex = app.state.get( 'stepIndex' );
				numSteps = app.state.get( 'currentTutorial.steps.length' );

				if ( currentStepIndex < numSteps - 1 ) {
					app.state.set( 'stepIndex', currentStepIndex + 1 );
				}

				else {
					// advance to next tutorial
					currentTutorialIndex = app.state.get( 'tutorialIndex' );
					numTutorials = app.state.get( 'tutorials.length' );

					if ( currentTutorialIndex < numTutorials - 1 ) {
						app.state.set({
							tutorialIndex: currentTutorialIndex + 1,
							stepIndex: 0
						});
					}
				}
			},
			prevTutorial: function () {
				var currentTutorialIndex;

				currentTutorialIndex = app.state.get( 'tutorialIndex' );

				if ( currentTutorialIndex > 0 ) {
					app.state.set({
						tutorialIndex: currentTutorialIndex - 1,
						stepIndex: 0
					});
				}
			},
			nextTutorial: function () {
				var currentTutorialIndex;

				currentTutorialIndex = app.state.get( 'tutorialIndex' );

				if ( currentTutorialIndex < tutorials.length - 1 ) {
					app.state.set({
						tutorialIndex: currentTutorialIndex + 1,
						stepIndex: 0
					});
				}
			},
			fix: function () {
				var fixed, currentStep, currentTutorial;

				currentStep = app.state.get( 'currentStep' );

				fixed = currentStep.fixed;

				if ( !fixed ) {
					throw new Error( 'Missing completed code for this step' );
				}

				editors.template.setValue( fixed.template || currentStep.template || '' );
				editors.javascript.setValue( fixed.javascript || currentStep.javascript || '' );
				editors.console.setValue( fixed.console || currentStep.console || '' );

				report( 'javascript', 'fix', null, app.state.get( 'tutorialStepCode' ) );

				executeJs( true );
			},
			reset: function () {
				reset( app.state.get( 'currentStep' ) );
			}
		});
	};

});