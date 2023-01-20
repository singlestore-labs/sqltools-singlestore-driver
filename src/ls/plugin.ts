import { ILanguageServerPlugin } from '@sqltools/types';
import SingleStore from './driver';
import { DRIVER_ALIASES } from './../constants';

const SingleStoreDriverPlugin: ILanguageServerPlugin = {
  register(server) {
    DRIVER_ALIASES.forEach(({ value }) => {
      server.getContext().drivers.set(value, SingleStore);
    });
  }
}

export default SingleStoreDriverPlugin;