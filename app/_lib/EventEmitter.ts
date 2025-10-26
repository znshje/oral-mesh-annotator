import {EventEmitter} from 'events';

const eventEmitter = new EventEmitter();

export const removeEventEmitterListeners = () => {
    eventEmitter.removeAllListeners();
};

export const subscribe = (event, listener) => {
    eventEmitter.addListener(event, listener);
};

export const publish = (event, ...args) => {
    eventEmitter.emit(event, ...args);
};

export const unsubscribe = (event, listener) => {
    eventEmitter.removeListener(event, listener);
};