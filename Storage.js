
/**
 * Class to parse and reconstruct the numworks' internal storage.
 * Only parses python scripts for now, ditches the rest.
 * @TODO parse other things.
 *
 * @author Maxime "M4x1m3" FRIESS
 * @license MIT
 */
class Storage {
    constructor() {
        this.magik = null;
        this.records = null;
    }

    async __encodePyRecord(record) {
        var content = new TextEncoder("utf-8").encode(record.code);

        record.data = new Blob([
            concatTypedArrays(
                new Uint8Array([record.autoImport ? 1 : 0]),
                concatTypedArrays(
                    content,
                    new Uint8Array([0])
                )
            )
        ]);

        delete record.autoImport;
        delete record.code;

        return record;
    }

    __getRecordEncoders() {
        return {
            py: this.__encodePyRecord.bind(this)
        };
    }

    async __assembleStorage(records, maxSize) {
        const encoder = new TextEncoder();

        var data = new Uint8Array([0xBA, 0xDD, 0x0B, 0xEE]); // Magic value 0xBADD0BEE (big endian)

        for (var i in records) {
            var record = records[i];
            var name = record.name + "." + record.type;

            var encoded_name = concatTypedArrays(
                encoder.encode(name),
                new Uint8Array([0])
            );

            var encoded_content = concatTypedArrays(
                encoded_name,
                new Uint8Array(await record.data.arrayBuffer())
            );

            var length_buffer = new Uint8Array([0xFF, 0xFF]);

            encoded_content = concatTypedArrays(length_buffer, encoded_content);

            var dv = new DataView(encoded_content.buffer);
            dv.setUint16(0, encoded_content.length, true);

            if (data.length + encoded_content.length + 2 > maxSize) {
                console.error("Too much data!");
                throw new Error("Too much data!");
            }

            data = concatTypedArrays(data, encoded_content);
        }

        data = concatTypedArrays(data, new Uint8Array([0, 0]));

        return new Blob([data]);
    }

    async __encodeRecord(record) {
        var encoders = this.__getRecordEncoders();

        if (record.type in encoders) {
            record = encoders[record.type](record);
        }

        return record;
    }

    /**
     * Encode the storage from data stored in this class.
     * The second 0xBAD00BEE isn't included.
     *
     * @param   size        max size the storage can take
     *
     * @return  a blob, representing the encoded storage.
     *
     * @throw   Errors      when too much data is passed.
     */
    async encodeStorage(size) {
        var records = Object.assign({}, this.records);

        for (var i in this.records) {
            records[i] = await this.__encodeRecord(records[i]);

        }

        return await this.__assembleStorage(records, size);
    }

    async __sliceStorage(blob) {
        var dv = new DataView(await blob.arrayBuffer());

        if (dv.getUint32(0x00, false) === 0xBADD0BEE) {
            var offset = 4;
            var records = [];

            do {
                var size = dv.getUint16(offset, true);

                if (size === 0) break;

                var name = this.__readString(dv, offset + 2, size - 2);

                var data = blob.slice(offset + 2 + name.size, offset + size);

                var record = {
                    name: name.content.split(/\.(?=[^\.]+$)/)[0], // eslint-disable-line no-useless-escape
                    type: name.content.split(/\.(?=[^\.]+$)/)[1], // eslint-disable-line no-useless-escape
                    data: data,
                };

                records.push(record);

                offset += size;

            } while (size !== 0 && offset < blob.size);

            return records;
        } else {
            return {};
        }
    }

    __readString(dv, index, maxLen) {
        var out = "";
        var i = 0;
        for (i = 0; i < maxLen || maxLen === 0; i++) {
            var chr = dv.getUint8(index + i);

            if (chr === 0) {
                break;
            }

            out += String.fromCharCode(chr);
        }

        return {
            size: i + 1,
            content: out
        };
    }

    async __parsePyRecord(record) {
        var dv = new DataView(await record.data.arrayBuffer());

        record.autoImport = dv.getUint8(0) !== 0;
        record.code = this.__readString(dv, 1, record.data.size - 1).content;

        delete record.data;

        return record;
    }

    __getRecordParsers() {
        return {
            py: this.__parsePyRecord.bind(this)
        };
    }

    async __parseRecord(record) {
        if (record.type != "py") {
            console.log(record);
            let dv = new DataView(await record.data.arrayBuffer());
            record.code = this.__readString(dv, 1, record.data.size).content;
            delete record.data;
            return record;
        }
        return await this.__parsePyRecord(record);
    }

    /**
     * Decode the storage.
     *
     * @param   blob        the encoded storage.
     */
    async parseStorage(blob) {
        var dv = new DataView(await blob.arrayBuffer());

        this.magik = dv.getUint32(0x00, false) === 0xBADD0BEE;

        this.records = {};

        if (this.magik) {
            this.records = await this.__sliceStorage(blob);

            for (var i in this.records) {
                this.records[i] = await this.__parseRecord(this.records[i]);

                // Throwing away non-python stuff, for convinience.
                // if (this.records[i].type !== 'py') this.records.splice(i, 1);
            }
        }
    }
}

function concatTypedArrays(a, b) {
    // Checks for truthy values on both arrays
    if (!a && !b) throw new Error("Please specify valid arguments for parameters a and b.");

    // Checks for truthy values or empty arrays on each argument
    // to avoid the unnecessary construction of a new array and
    // the type comparison
    if (!b || b.length === 0) return a;
    if (!a || a.length === 0) return b;

    // Make sure that both typed arrays are of the same type
    if (Object.prototype.toString.call(a) !== Object.prototype.toString.call(b))
        throw new Error("The types of the two arguments passed for parameters a and b do not match.");

    var c = new a.constructor(a.length + b.length);
    c.set(a);
    c.set(b, a.length);

    return c;
}

module.exports = Storage;

