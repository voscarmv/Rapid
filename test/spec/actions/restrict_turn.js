describe('actionRestrictTurn', function() {
    it('adds a via node restriction to an unrestricted turn', function() {
        //
        // u === * --- w
        //
        var graph = new Rapid.Graph([
            Rapid.osmNode({id: 'u'}),
            Rapid.osmNode({id: '*'}),
            Rapid.osmNode({id: 'w'}),
            Rapid.osmWay({id: '=', nodes: ['u', '*']}),
            Rapid.osmWay({id: '-', nodes: ['*', 'w']})
        ]);

        var turn = {
            from: { node: 'u', way: '=' },
            via:  { node: '*'},
            to:   { node: 'w', way: '-' }
        };

        var action = Rapid.actionRestrictTurn(turn, 'no_straight_on', 'r');
        graph = action(graph);

        var r = graph.entity('r');
        expect(r.tags).to.eql({type: 'restriction', restriction: 'no_straight_on'});

        var f = r.memberByRole('from');
        expect(f.id).to.eql('=');
        expect(f.type).to.eql('way');

        var v = r.memberByRole('via');
        expect(v.id).to.eql('*');
        expect(v.type).to.eql('node');

        var t = r.memberByRole('to');
        expect(t.id).to.eql('-');
        expect(t.type).to.eql('way');
    });


    it('adds a via way restriction to an unrestricted turn', function() {
        //
        // u === v1
        //       |
        // w --- v2
        //
        var graph = new Rapid.Graph([
            Rapid.osmNode({id: 'u'}),
            Rapid.osmNode({id: 'v1'}),
            Rapid.osmNode({id: 'v2'}),
            Rapid.osmNode({id: 'w'}),
            Rapid.osmWay({id: '=', nodes: ['u', 'v1']}),
            Rapid.osmWay({id: '|', nodes: ['v1', 'v2']}),
            Rapid.osmWay({id: '-', nodes: ['v2', 'w']})
        ]);

        var turn = {
            from: { node: 'u', way: '=' },
            via:  { ways: ['|'] },
            to:   { node: 'w', way: '-' }
        };

        var action = Rapid.actionRestrictTurn(turn, 'no_u_turn', 'r');
        graph = action(graph);

        var r = graph.entity('r');
        expect(r.tags).to.eql({type: 'restriction', restriction: 'no_u_turn'});

        var f = r.memberByRole('from');
        expect(f.id).to.eql('=');
        expect(f.type).to.eql('way');

        var v = r.memberByRole('via');
        expect(v.id).to.eql('|');
        expect(v.type).to.eql('way');

        var t = r.memberByRole('to');
        expect(t.id).to.eql('-');
        expect(t.type).to.eql('way');
    });
});
