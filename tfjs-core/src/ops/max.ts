/**
 * @license
 * Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */

import {KernelBackend} from '../backends/backend';
import {ENGINE, ForwardFunc} from '../engine';
import {Max, MaxAttrs, MaxInputs} from '../kernel_names';
import {NamedAttrMap} from '../kernel_registry';
import {Tensor} from '../tensor';
import {GradSaveFunc, NamedTensorMap} from '../tensor_types';
import {convertToTensor} from '../tensor_util_env';
import {TensorLike} from '../types';
import * as util from '../util';
import {reshape} from './array_ops';
import * as axis_util from './axis_util';
import {op} from './operation';
import {transpose} from './transpose';

/**
 * Computes the maximum of elements across dimensions of a `tf.Tensor`.
 *
 * Reduces the input along the dimensions given in `axes`. Unless `keepDims`
 * is true, the rank of the `tf.Tensor` is reduced by 1 for each entry in
 * `axes`. If `keepDims` is true, the reduced dimensions are retained with
 * length 1. If `axes` has no entries, all dimensions are reduced, and an
 * `tf.Tensor` with a single element is returned.
 *
 * ```js
 * const x = tf.tensor1d([1, 2, 3]);
 *
 * x.max().print();  // or tf.max(x)
 * ```
 *
 * ```js
 * const x = tf.tensor2d([1, 2, 3, 4], [2, 2]);
 *
 * const axis = 1;
 * x.max(axis).print();  // or tf.max(x, axis)
 * ```
 *
 * @param x The input tensor.
 * @param axis The dimension(s) to reduce. By default it reduces
 *     all dimensions.
 * @param keepDims If true, retains reduced dimensions with size 1.
 */
/** @doc {heading: 'Operations', subheading: 'Reduction'} */
function max_<T extends Tensor>(
    x: Tensor|TensorLike, axis: number|number[] = null, keepDims = false): T {
  const $x = convertToTensor(x, 'x', 'max');
  const forward: ForwardFunc<Tensor> =
      (backend: KernelBackend, save: GradSaveFunc) => {
        let numDataIds = backend.numDataIds();
        console.log('--------------- MAX KERNEL');
        console.log('start num data ids:', numDataIds);
        const origAxes = util.parseAxisParam(axis, $x.shape);
        let axes = origAxes;
        const permutedAxes = axis_util.getAxesPermutation(axes, $x.rank);
        let maxInput = $x;
        if (permutedAxes != null) {
          console.log('TRANSPOSE');
          maxInput = transpose($x, permutedAxes);
          axes = axis_util.getInnerMostAxes(axes.length, maxInput.rank);
        }

        numDataIds = backend.numDataIds();
        console.log('num data ids after transpose', numDataIds);

        const y = backend.max(maxInput, axes);
        numDataIds = backend.numDataIds();
        console.log('num data ids after max', numDataIds);
        save([$x, y]);

        if (permutedAxes != null) {
          backend.disposeData(maxInput.dataId);
        }

        numDataIds = backend.numDataIds();
        console.log('num data ids after dispose', numDataIds);

        let output = y;

        if (keepDims) {
          console.log('RESHAPE');
          output =
              reshape(y, axis_util.expandShapeToKeepDim(y.shape, origAxes));
        }

        numDataIds = backend.numDataIds();
        console.log('num data ids after reshape', numDataIds);
        return output;
      };
  const inputs: MaxInputs = {x: $x};
  const attrs: MaxAttrs = {reductionIndices: axis, keepDims};

  return ENGINE.runKernelFunc(
             forward, inputs as {} as NamedTensorMap, null /* gradient */, Max,
             attrs as {} as NamedAttrMap) as T;
}

export const max = op({max_});
