import type { ActorMethod } from '@dfinity/agent';

export interface _SERVICE {
  'build_stellar_transaction' : ActorMethod<
    [string, bigint, [] | [string]],
    { 'Ok' : string } |
      { 'Err' : string }
  >,
  'check_trustline' : ActorMethod<
    [string, string, [] | [string]],
    { 'Ok' : string } |
      { 'Err' : string }
  >,
  'create_trustline' : ActorMethod<
    [string, string, [] | [string], [] | [string]],
    { 'Ok' : string } |
      { 'Err' : string }
  >,
  'execute_bridge_lock' : ActorMethod<
    [string, string, bigint, string, string, [] | [string]],
    { 'Ok' : string } |
      { 'Err' : string }
  >,
  'execute_token_swap' : ActorMethod<
    [string, string, string, bigint, string, [] | [string]],
    { 'Ok' : string } |
      { 'Err' : string }
  >,
  'greet' : ActorMethod<[string], string>,
  'public_key_stellar' : ActorMethod<
    [],
    { 'Ok' : string } |
      { 'Err' : string }
  >,
}

export const idlFactory = ({ IDL }: any) => {
  return IDL.Service({
    'build_stellar_transaction' : IDL.Func(
        [IDL.Text, IDL.Nat64, IDL.Opt(IDL.Text)],
        [IDL.Variant({ 'Ok' : IDL.Text, 'Err' : IDL.Text })],
        [],
      ),
    'check_trustline' : IDL.Func(
        [IDL.Text, IDL.Text, IDL.Opt(IDL.Text)],
        [IDL.Variant({ 'Ok' : IDL.Text, 'Err' : IDL.Text })],
        [],
      ),
    'create_trustline' : IDL.Func(
        [IDL.Text, IDL.Text, IDL.Opt(IDL.Text), IDL.Opt(IDL.Text)],
        [IDL.Variant({ 'Ok' : IDL.Text, 'Err' : IDL.Text })],
        [],
      ),
    'execute_bridge_lock' : IDL.Func(
        [IDL.Text, IDL.Text, IDL.Nat64, IDL.Text, IDL.Text, IDL.Opt(IDL.Text)],
        [IDL.Variant({ 'Ok' : IDL.Text, 'Err' : IDL.Text })],
        [],
      ),
    'execute_token_swap' : IDL.Func(
        [IDL.Text, IDL.Text, IDL.Text, IDL.Nat64, IDL.Text, IDL.Opt(IDL.Text)],
        [IDL.Variant({ 'Ok' : IDL.Text, 'Err' : IDL.Text })],
        [],
      ),
    'greet' : IDL.Func([IDL.Text], [IDL.Text], ['query']),
    'public_key_stellar' : IDL.Func(
        [],
        [IDL.Variant({ 'Ok' : IDL.Text, 'Err' : IDL.Text })],
        [],
      ),
  });
};