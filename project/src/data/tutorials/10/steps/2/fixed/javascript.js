var cities, ractive;

ractive = new Ractive({
  el: output,
  template: template,
  data: {
    scale: function ( val ) {
      // quick and dirty...
      return 2 * Math.abs( val );
    },
    format: function ( val, degreeType ) {
      if ( degreeType === 'fahrenheit' ) {
        // convert celsius to fahrenheit
        val = ( val * 1.8 ) + 32;
      }

      return val.toFixed( 1 ) + '°';
    },
    getColor: function ( val ) {
      // quick and dirty function to pick a colour - the higher the
      // temperature, the warmer the colour
      var r = Math.max( 0, Math.min( 255, Math.floor( 2.56 * ( val + 50 ) ) ) );
      var g = 100;
      var b = Math.max( 0, Math.min( 255, Math.floor( 2.56 * ( 50 - val ) ) ) );

      return 'rgb(' + r + ',' + g + ',' + b + ')';
    },
    monthNames: [ 'J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D' ]
  }
});

// animate to the next city, then to the next one after that, and so on...
ractive.observe( 'selected', function ( index ) {
  if ( index === undefined ) {
    return;
  }

  this.animate( 'selectedCity', cities[ index ], {
    easing: 'easeOut',
    complete: function () {
      setTimeout( function () {
        ractive.set( 'selected', ( index + 1 ) % cities.length );
      }, 2000 );
    }
  });
});

// load our data
$.getJSON( 'files/data/temperature.json' ).then( function ( data ) {
  cities = data;

  ractive.set({
    cities: cities
  });

  // kick off the loop
  ractive.set( 'selected', 0 );
});