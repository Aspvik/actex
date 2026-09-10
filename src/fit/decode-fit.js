import { Decoder, Stream } from "@garmin/fitsdk";
import { MAX_FILE_SIZE_BYTES } from "../utils/constants.js";

export const decodeFitFile = async (file) => {
  if (!file?.name?.toLowerCase().endsWith(".fit")) throw new Error("Choose a file with the .fit extension.");
  if (file.size > MAX_FILE_SIZE_BYTES) throw new Error(`This file is larger than the ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB limit.`);
  const stream = Stream.fromArrayBuffer(await file.arrayBuffer());
  if (!Decoder.isFIT(stream)) throw new Error("The selected file is not a valid FIT file.");
  const decoder = new Decoder(stream);
  const integrityWarning = !decoder.checkIntegrity();
  const { messages, errors } = decoder.read({
    applyScaleAndOffset: true,
    expandSubFields: true,
    expandComponents: true,
    convertTypesToStrings: true,
    convertDateTimesToDates: true,
    includeUnknownData: false,
    mergeHeartRates: true
  });
  if (!messages || (!messages.sessionMesgs?.length && !messages.recordMesgs?.length)) throw new Error("The FIT file contains no activity or session data.");
  return { messages, errors: errors ?? [], integrityWarning };
};
