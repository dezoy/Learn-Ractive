var ractive = new Ractive({
  el: output,
  template: template,
  data: {
    country: 'the UK',
    population: 62641000,
    format: function ( num ) {
      if ( num > 1000000000 ) return ( num / 1000000000 ).toFixed( 1 ) + ' billion';
      if ( num > 1000000 ) return ( num / 1000000 ).toFixed( 1 ) + ' million';
      if ( num > 1000 ) return ( Math.floor( num / 1000 ) ) + ',' + ( num % 1000 );
      return num;
    }
  }
});