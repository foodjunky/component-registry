'use strict';

export default function(container, config) {
  container.component([
    // Dependencies
    'component-one',
    'component-two',
    // Builder
    (one, two) => {
      return {
        name: 'component-three',
        one: one,
        two: two
      };
    }
  ]);
}
