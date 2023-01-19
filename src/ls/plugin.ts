import { ILanguageServerPlugin } from '@sqltools/types';
import SingleStoreDB from './driver';
import { DRIVER_ALIASES } from './../constants';

const SingleStoreDBDriverPlugin: ILanguageServerPlugin = {
  register(server) {
    DRIVER_ALIASES.forEach(({ value }) => {
      server.getContext().drivers.set(value, SingleStoreDB as any);
    });
  }
}

export default SingleStoreDBDriverPlugin;
