import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface HttpHeader { 'value' : string, 'name' : string }
export interface HttpResponse {
  'status' : bigint,
  'body' : Uint8Array | number[],
  'headers' : Array<HttpHeader>,
}
export type Result = { 'Ok' : string } |
  { 'Err' : string };
export interface TransformArgs {
  'context' : Uint8Array | number[],
  'response' : HttpResponse,
}
export interface _SERVICE {
  'build_stellar_transaction' : ActorMethod<
    [string, bigint, [] | [string]],
    Result
  >,
  'check_trustline' : ActorMethod<[string, string, [] | [string]], Result>,
  'create_trustline' : ActorMethod<
    [string, string, [] | [string], [] | [string]],
    Result
  >,
  'execute_token_swap' : ActorMethod<
    [string, string, string, bigint, string, [] | [string]],
    Result
  >,
  'get_account_assets' : ActorMethod<[[] | [string]], Result>,
  'get_account_balance' : ActorMethod<[[] | [string]], Result>,
  'get_swap_quote' : ActorMethod<
    [string, string, string, [] | [string]],
    Result
  >,
  'greet' : ActorMethod<[string], string>,
  'public_key_stellar' : ActorMethod<[], Result>,
  'transform_http_response' : ActorMethod<[TransformArgs], HttpResponse>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
