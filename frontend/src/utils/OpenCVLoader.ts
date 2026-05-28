/**
 * OpenCVLoader - Lightweight version that doesn't actually load OpenCV to avoid memory issues
 */


/**
 * Fake OpenCV loader that just returns success
 * Instead of actually loading the heavy OpenCV.js library, we'll use our simplified analyzer
 */
export const loadOpenCV = async (): Promise<boolean> => {
  console.log("Using lightweight face analyzer instead of full OpenCV");
  return Promise.resolve(true);
};

export default loadOpenCV;
