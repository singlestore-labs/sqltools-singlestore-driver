import { IDriverAlias } from '@sqltools/types';

const { displayName } = require('../package.json');

export const DRIVER_ALIASES: IDriverAlias[] = [
  { displayName: displayName, value: displayName },
];