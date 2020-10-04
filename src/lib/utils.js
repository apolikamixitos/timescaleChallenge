/**
 * Calculates the median of a list of numbers
 * @param {Array} numbers
 */
function calculateMedian(numbers) {
  let median = 0;
  const totalNumbers = numbers.length;
  numbers.sort();

  if (totalNumbers % 2 === 0) {
    // average of two middle numbers
    median = (numbers[totalNumbers / 2 - 1] + numbers[totalNumbers / 2]) / 2;
  } else {
    // middle number only
    median = numbers[(totalNumbers - 1) / 2];
  }

  return median;
}

module.exports = {
  calculateMedian,
};
