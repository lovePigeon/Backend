import mongoose from 'mongoose';

const SpatialUnitSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  geom: {
    type: {
      type: String,
      enum: ['Polygon', 'MultiPolygon'],
      required: true
    },
    coordinates: {
      type: [[[Number]]],
      required: true
    }
  },
  meta: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  _id: false,
  collection: 'spatial_units'
});

export default mongoose.model('SpatialUnit', SpatialUnitSchema);

