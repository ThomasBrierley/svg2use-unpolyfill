
const svg2useUnpolyfill = (() => {

	'use strict';

	const SVG = document.createElementNS(
		'http://www.w3.org/2000/svg', 'svg');

	const main = (useRoot = document.body, refRoot = document.body) => {
		new MutationObserver(mut => query(
			useRoot,
			refRoot
		)).observe(useRoot, {
			subtree: true,
			childList: true
		});
		query(useRoot, refRoot);
	};

	/**
	 * Query Use Elements
	 * ==================
	 * A depth first search for use elements, recursing through href subtrees.
	 * Deepest elements are cloned first ensuring each href is fully expanded
	 * before being cloned itself, this avoids generating use elements which in
	 * turn preserves the validity of the static query lists.
	 *
	 * A depth-first approach also simplifies mutation-observers by implicitly
	 * delegating nested mutation handling automatically. The disadvantage is
	 * mutations cascade through observers in separate stack frames, which may
	 * cause perceptible latency for deeply nested use elements.
	 */

	const query = (v, g) => {
		let n = v.querySelectorAll(
			'svg use:not([visibility])');
		v.nodeName === 'use' && (n = [v]);
		for (let w of n) if (!w.visited) {
			let x = g.querySelector(
				`svg ${w.href.baseVal}`);
			g.nodeName === 'use' && (x = g);
			if (x) {
				w.visited = 1;
				query(x, g);
				clone(w, x);
			}
		}
	};

	/**
	 * Clone Use Elements
	 * ==================
	 * Generate use DOM by cloning the use node as a group and cloning the ref
	 * tree into that group. The resulting cpy tree is inserted before the use
	 * element which is hidden but otherwise untouched to preserve the effects
	 * of any references or queries directly targeting it.
	 *
	 * Clones are equivalent to the real use DOM except they do not naturally
	 * reflect mutations to their reference. To emulate this, the use and ref
	 * nodes are observed for all subtree mutations, and the parent svg is
	 * observed for topology mutations involving use elements.
	 */

	const clone = (use, ref) => {
		const svg = use.ownerSVGElement;
		if (ref.nodeName === 'use') {
			ref = [...ref._cpy][0];
		}
		use._ref = ref;
		// watch svg
		move.observe(svg, {
			subtree: true,
			childList: true,
			attributes: false
		});
		// clone use
		SVG.innerHTML = use.outerHTML.replace(
		/<use([\s\S]+?)<\/use>/g, '<g$1</g>').replace(
		/<symbol([\s\S]+?)<\/symbol>/g, '<svg$1</svg>');
		const usecpy = use._usecpy = SVG.children[0];
		use.parentNode.insertBefore(usecpy, use);
		use.setAttribute('visibility', 'hidden');
		link(use, usecpy);
		// watch use
		sync.observe(use, {
			subtree: false,
			childList: false,
			attributes: true
		});
		// clone ref
		SVG.innerHTML = ref.outerHTML.replace(
		/<use([\s\S]+?)<\/use>/g, '<g$1</g>').replace(
		/<symbol([\s\S]+?)<\/symbol>/g, '<svg$1</svg>');
		const refcpy = use._refcpy = SVG.children[0];
		usecpy.insertBefore(refcpy, null);
		ref.setAttribute('visibility', 'default');
		link(ref, refcpy);
		// watch ref
		sync.observe(ref, {
			subtree: true,
			childList: true,
			attributes: true
		});
		// init xywh
		xywh(use);
	};

	/**
	 * Link Tree Recursively
	 * =====================
	 * For each pair of nodes between the trees create an unambiguous context
	 * free reference to each other, to facilitate updating within mutation
	 * observers and reliable unlinking in the case of topology mutations.
	 */

	const link = (ref, cpy) => {
		ref._cpy = ref._cpy || new Set();
		ref.setAttribute('ref', true);
		ref._cpy.add(cpy);
		cpy.setAttribute('cpy', true);
		cpy._ref = ref;
		for (let i = 0; i < cpy.children.length; i ++) {
			link(ref.children[i], cpy.children[i]);
		}
	};

	const unlink = (ref, cpy) => {
		ref._cpy = ref._cpy || new Set();
		ref.setAttribute('ref', true);
		ref._cpy.delete(cpy);
		cpy.setAttribute('cpy', true);
		cpy._ref = null;
		for (let i = 0; i < cpy.children.length; i ++) {
			unlink(cpy.children[i]._ref, cpy.children[i]);
		}
	};

	/**
	 * Sync Tree Observer
	 * ==================
	 * For topology mutations to a subtree, simply destroy and regenerate it
	 * (this is faster and simpler than replicating individual child nodes).
	 * For attribute only mutations, simply copy to respective cpy nodes.
	 */

	const sync = new MutationObserver(mut => {
		for (let rec of mut) {
			let ref = rec.target;
			// update topologies
			if (rec.type === 'childList') {
				for (let cpy of [...ref._cpy]) {
					unlink(ref, cpy);
					cpy.innerHTML = ref.innerHTML.replace(
					/<use([\s\S]+?)<\/use>/g, '<g$1</g>');
					link(ref, cpy);
				}
			}
			// update attributes
			if (rec.type === 'attributes') {
				for (let cpy of [...ref._cpy]) {
					let key = rec.attributeName;
					let val = ref.getAttribute(key);
					cpy.setAttribute(key, val);
					ref.nodeName === 'use' && xywh(ref, key);
				}
			}
		}
	});

	/**
	 * Move Tree Observer
	 * ==================
	 * For topology mutations involving use elements, detach/attach respective
	 * cpy node. The owner svg is observed to prevent interference when the use
	 * parent is a ref root (since only one observer is allowed per node).
	 */

	const move = new MutationObserver(mut => {
		for (let rec of mut) {
			let ref = rec.target;
			// detach clonetrees
			for (let use of rec.removedNodes) {
				if (use.nodeName === 'use' && use._cpy) {
					let cpy = [...use._cpy][0];
					ref.removeChild(cpy);
				}
			}
			// attach clonetrees
			for (let use of rec.addedNodes) {
				if (use.nodeName === 'use' && use._cpy) {
					let cpy = [...use._cpy][0];
					ref.insertBefore(cpy, use);
				}
			}
		}
	});

	/**
	 * Use X Y Width Height
	 * ====================
	 * Wrangle the "x", "y", "width", "height" attributes as per the SVG spec.
	 * "x" and "y" are coerced into a translate() appended to usecpy transform,
	 * whereas "width" and "height" override respective attributes on refcpy.
	 */

	const xywh = (use, key = 'xywidthheight') => {
		if (/x|y|transform/.test(key)) {
			let v = use.getAttribute('transform') || '';
			const x = +use.getAttribute('x');
			const y = +use.getAttribute('y');
			v += ` translate(${x || 0},${y || 0})`;
			use._usecpy.setAttribute('transform', v);
		}
		if (/width/.test(key)) {
			let v = use._ref.getAttribute('width') || '';
			const w = use.getAttribute('width');
			v = w || v || '100%';
			use._refcpy.setAttribute('width', v);
		}
		if (/height/.test(key)) {
			let v = use._ref.getAttribute('height') || '';
			const h = use.getAttribute('height');
			v = h || v || '100%';
			use._refcpy.setAttribute('height', v);
		}
	};

	/**
	 * Filter Query Selectors
	 * ======================
	 * Unlike real use DOMs clone use DOMs are exposed to all regular DOM APIs.
	 * To mitigate resulting incompatibilities, all native query selectors are
	 * wrapped with a filter to exclude clones (nodes with [cpy] attribute).
	 */

	const filter = (obj, key) => {
		const querySelector = obj.querySelector;
		obj.querySelector = function (query) {
			// svg2useUnpolyfill Filter
			return querySelector.call(this, query.replace(
				/(\S+)(\s*,|\s*$)/g, '$1:not([cpy])$2'
			));
		};
		const querySelectorAll = obj.querySelectorAll;
		obj.querySelectorAll = function (query) {
			// svg2useUnpolyfill Filter
			return querySelectorAll.call(this, query.replace(
				/(\S+)(\s*,|\s*$)/g, '$1:not([cpy])$2'
			));
		};
	};

	filter(document);
	filter(Element.prototype);
	filter(DocumentFragment.prototype);

	return main;

}) ();
